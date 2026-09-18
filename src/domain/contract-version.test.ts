import { describe, expect, it } from "vitest";
import { purposeContractEvidence } from "./evidence-sources.js";
import { selectPurposeContractAt } from "./evidence-verification.js";

describe("Stage 7 — Purpose Contract version change", () => {
  it("binds historical evidence to v4 and post-change evidence to v5", () => {
    const transition = "2026-09-18T14:00:00.000Z";
    const v4 = purposeContractEvidence({
      contractId: "analytics-product-view",
      integrationId: "analytics-partner",
      version: "4",
      purpose: "Measure product interest",
      resources: ["analytics.events"],
      fields: ["product.id", "product.category", "product.price"],
      operations: ["send"],
      validTriggers: ["product.viewed"],
      environment: "production",
      validFrom: "2026-09-18T00:00:00.000Z",
      reviewAt: transition,
      expiresAt: transition,
      owner: "commerce",
      approvedBy: "privacy",
      changeReason: "Pre-loyalty analytics scope",
    }, "contract:v4");
    const v5 = purposeContractEvidence({
      contractId: "analytics-product-view",
      integrationId: "analytics-partner",
      version: "5",
      purpose: "Measure product interest with loyalty segmentation",
      resources: ["analytics.events"],
      fields: ["product.id", "product.category", "product.price", "customer.loyalty_tier"],
      operations: ["send"],
      validTriggers: ["product.viewed"],
      environment: "production",
      validFrom: transition,
      reviewAt: "2026-10-18T14:00:00.000Z",
      expiresAt: null,
      owner: "commerce",
      approvedBy: "privacy",
      changeReason: "Approved loyalty segmentation field",
    }, "contract:v5");

    expect(selectPurposeContractAt("analytics-partner", "production", "2026-09-18T13:59:59.000Z", [v4, v5])?.contract.version).toBe("4");
    expect(selectPurposeContractAt("analytics-partner", "production", "2026-09-18T14:00:01.000Z", [v4, v5])?.contract.version).toBe("5");
    expect(v4.contract.fields).not.toContain("customer.loyalty_tier");
    expect(v5.contract.fields).toContain("customer.loyalty_tier");
  });
});
