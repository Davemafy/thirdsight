import { describe, expect, it } from "vitest";
import type { EvidenceGraphRecord } from "./evidence";
import {
  resolveIntegrationIdentity,
  type IntegrationOriginBinding,
} from "./integration-identity";

const BASE_EVIDENCE: EvidenceGraphRecord = {
  recordId: "browser:sensor:obs-1",
  observedAt: "2026-09-17T12:00:00.000Z",
  integrationId: null,
  integrationResolution: "UNRESOLVED",
  should: {
    status: "UNKNOWN",
    confidence: "UNKNOWN",
    value: null,
    provenance: [],
  },
  could: {
    status: "PARTIAL",
    confidence: "OBSERVED_LOWER_BOUND",
    value: {
      kind: "BROWSER_REQUEST_EXECUTION",
      destinationOrigin: "https://analytics.example.com",
      statement: "lower bound",
    },
    provenance: [],
  },
  did: {
    status: "KNOWN",
    confidence: "OBSERVED",
    value: {
      boundary: "browser",
      phase: "ATTEMPTED",
      pageOrigin: "https://shop.example.com",
      destinationOrigin: "https://analytics.example.com",
      destinationPath: "/collect",
      method: "POST",
      resourceType: "Fetch",
      initiatorType: "script",
      hasPostData: true,
      originRelationship: "CROSS_ORIGIN",
    },
    provenance: [],
  },
  why: {
    status: "UNKNOWN",
    confidence: "UNKNOWN",
    value: null,
    provenance: [],
  },
};

function binding(
  overrides: Partial<IntegrationOriginBinding> = {},
): IntegrationOriginBinding {
  return {
    bindingId: "binding-1",
    integrationId: "analytics-partner",
    origin: "https://analytics.example.com",
    environment: "demo",
    confidence: "AUTHORITATIVE",
    sourceId: "merchant-registry:binding-1",
    validFrom: "2026-09-01T00:00:00.000Z",
    validTo: null,
    ...overrides,
  };
}

describe("resolveIntegrationIdentity", () => {
  it("resolves one active exact-origin binding", () => {
    const result = resolveIntegrationIdentity(BASE_EVIDENCE, [binding()], "demo");

    expect(result.resolution.status).toBe("RESOLVED");
    expect(result.resolution.integrationId).toBe("analytics-partner");
    expect(result.resolution.confidence).toBe("AUTHORITATIVE");
    expect(result.evidence.integrationId).toBe("analytics-partner");
    expect(result.evidence.integrationResolution).toBe("RESOLVED");
  });

  it("does not use suffix or substring matching", () => {
    const result = resolveIntegrationIdentity(
      BASE_EVIDENCE,
      [binding({ origin: "https://example.com" })],
      "demo",
    );

    expect(result.resolution.status).toBe("UNRESOLVED");
    expect(result.evidence.integrationId).toBeNull();
  });

  it("ignores expired and wrong-environment bindings", () => {
    const result = resolveIntegrationIdentity(
      BASE_EVIDENCE,
      [
        binding({ validTo: "2026-09-10T00:00:00.000Z" }),
        binding({ bindingId: "binding-2", environment: "production" }),
      ],
      "demo",
    );

    expect(result.resolution.status).toBe("UNRESOLVED");
  });

  it("marks conflicting active bindings as ambiguous instead of guessing", () => {
    const result = resolveIntegrationIdentity(
      BASE_EVIDENCE,
      [
        binding(),
        binding({
          bindingId: "binding-2",
          integrationId: "different-vendor",
          sourceId: "merchant-registry:binding-2",
        }),
      ],
      "demo",
    );

    expect(result.resolution.status).toBe("AMBIGUOUS");
    expect(result.resolution.integrationId).toBeNull();
    expect(result.evidence.integrationResolution).toBe("AMBIGUOUS");
  });
});
