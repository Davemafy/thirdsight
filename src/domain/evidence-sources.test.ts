import { describe, expect, it } from "vitest";
import {
  businessEventEvidence,
  purposeContractEvidence,
  type BusinessEvent,
  type PurposeContract,
} from "./evidence-sources.js";

describe("independent Gate 4 evidence sources", () => {
  it("marks an approved Purpose Contract as authoritative policy evidence", () => {
    const contract: PurposeContract = {
      contractId: "analytics-product-view",
      integrationId: "analytics-partner",
      version: "1",
      purpose: "Measure product interest",
      resources: ["analytics.events"],
      fields: ["product.id", "product.category", "product.price"],
      operations: ["send"],
      validTriggers: ["product.viewed"],
      environment: "production",
      validFrom: "2026-09-18T00:00:00.000Z",
      reviewAt: "2026-10-18T00:00:00.000Z",
      expiresAt: null,
      owner: "commerce",
      approvedBy: "privacy",
      changeReason: "Initial managed analytics contract",
    };

    const evidence = purposeContractEvidence(contract, "purpose-contract:analytics-product-view:v1");

    expect(evidence.provenance.source).toBe("purpose-contract");
    expect(evidence.provenance.confidence).toBe("AUTHORITATIVE");
    expect(evidence.contract.fields).not.toContain("customer.phone");
  });

  it("keeps first-party business context separate from the Purpose Contract", () => {
    const event: BusinessEvent = {
      id: "business-event-001",
      type: "product.viewed",
      timestamp: "2026-09-18T00:01:00.000Z",
      customerRefHash: "customer-ref-hash",
      integrationId: "analytics-partner",
    };

    const evidence = businessEventEvidence(event);

    expect(evidence.provenance.source).toBe("business-event");
    expect(evidence.provenance.confidence).toBe("AUTHORITATIVE");
    expect(evidence.provenance.sourceId).toBe(event.id);
  });
});
