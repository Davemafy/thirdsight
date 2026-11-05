import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetMemoryForTests } from "../../lib/commerce-store";
import { emitCheckoutCompleted } from "../../lib/integration";
import type { Order } from "../../lib/types";

const order: Order = {
  id: "11111111-2222-4333-8444-555555555555",
  orderNumber: "CDR-DEMO01",
  status: "CONFIRMED",
  paymentStatus: "SYNTHETIC_AUTHORIZED",
  email: "ada@example.test",
  phone: "+2348000000000",
  deliveryAddress: {
    firstName: "Ada", lastName: "Example",
    line1: "12 Demo Crescent", line2: "",
    city: "Abuja", state: "FCT", country: "Nigeria",
  },
  deliveryMethod: "STANDARD",
  paymentMethod: "TEST_VISA_4242",
  subtotal: 189900, discount: 0, delivery: 0, total: 189900,
  createdAt: "2026-09-21T12:00:00.000Z",
  estimatedDelivery: "2026-09-24T12:00:00.000Z",
  lines: [],
};

beforeEach(() => {
  delete process.env.DATABASE_URL;
  process.env.THIRDSIGHT_MANAGED_GATEWAY_URL =
    "https://thirdsight.example/api/managed-gateway";
  process.env.THIRDSIGHT_GATEWAY_API_KEY = "synthetic-key";
  __resetMemoryForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.THIRDSIGHT_MANAGED_GATEWAY_URL;
  delete process.env.THIRDSIGHT_GATEWAY_API_KEY;
});

describe("CEDAR delivery handoff outcome", () => {
  it("does not claim delivery when analytics succeeds but delivery returns 503", async () => {
    let analyticsCalls = 0;
    let deliveryCalls = 0;
    vi.stubGlobal("fetch", async (input: URL | string | Request) => {
      const url = new URL(String(input));
      if (url.searchParams.get("integration") === "cedar-analytics") {
        analyticsCalls++;
        return new Response(
          JSON.stringify({ receivedFields: ["order.id"], forbiddenFieldReceived: false }),
          { status: 202, headers: {
            "x-thirdsight-decision": "ALLOW",
            "x-thirdsight-request-id": "analytics-only",
          } },
        );
      }
      deliveryCalls++;
      return new Response(
        JSON.stringify({ error: "delivery receiver unavailable" }),
        { status: 503 },
      );
    });

    const result = await emitCheckoutCompleted(order);
    expect(analyticsCalls).toBe(1);
    expect(deliveryCalls).toBe(1);
    expect(result?.evidenceId).toBe("analytics-only");
    expect(result?.deliveryEvidenceId).toBeNull();
    expect(result?.partnerDelivered).toBe(false);
  });

  it("reports delivery only after the delivery call succeeds", async () => {
    vi.stubGlobal("fetch", async (input: URL | string | Request) => {
      const url = new URL(String(input));
      const delivery = url.searchParams.get("integration") === "cedar-delivery";
      return new Response(
        JSON.stringify({ receivedFields: ["order.id"], forbiddenFieldReceived: false }),
        { status: 202, headers: {
          "x-thirdsight-decision": "ALLOW",
          "x-thirdsight-request-id": delivery ? "delivery-proof" : "analytics-proof",
        } },
      );
    });

    const result = await emitCheckoutCompleted(order);
    expect(result?.partnerDelivered).toBe(true);
    expect(result?.deliveryEvidenceId).toBe("delivery-proof");
  });
});
