import { describe, expect, it } from "vitest";
import type { EvidenceGraphRecord } from "./evidence.js";
import { businessEventEvidence, purposeContractEvidence } from "./evidence-sources.js";
import { enrichEvidenceGraph } from "./evidence-verification.js";

const base: EvidenceGraphRecord = {
  recordId: "browser:sensor:obs",
  observedAt: "2026-09-18T10:02:00.000Z",
  integrationId: "analytics-partner",
  integrationResolution: "RESOLVED",
  should: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
  could: { status: "PARTIAL", confidence: "OBSERVED_LOWER_BOUND", value: null, provenance: [] },
  did: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
  why: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
};

describe("Gate 4 evidence projection", () => {
  it("projects SHOULD from policy and WHY from first-party context without using DID", () => {
    const contract = purposeContractEvidence({
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
      changeReason: "Initial contract",
    }, "purpose-contract:v1");
    const event = businessEventEvidence({
      id: "product-view-1",
      type: "product.viewed",
      timestamp: "2026-09-18T10:00:00.000Z",
      integrationId: "analytics-partner",
    });

    const result = enrichEvidenceGraph(base, { purposeContracts: [contract], businessEvents: [event] });

    expect(result.should.status).toBe("KNOWN");
    expect(result.should.value?.contractVersion).toBe("1");
    expect(result.should.provenance[0]?.source).toBe("purpose-contract");
    expect(result.why.status).toBe("PARTIAL");
    expect(result.why.value?.correlationStrength).toBe("TRIGGER_WINDOW");
    expect(result.why.provenance[0]?.source).toBe("business-event");
  });

  it("refuses to invent SHOULD or WHY when independent evidence is absent", () => {
    const result = enrichEvidenceGraph(base, { purposeContracts: [], businessEvents: [] });
    expect(result.should.status).toBe("UNKNOWN");
    expect(result.why.status).toBe("UNKNOWN");
  });

  it("does not enrich unresolved integration identity", () => {
    const unresolved = { ...base, integrationId: null, integrationResolution: "UNRESOLVED" as const };
    expect(enrichEvidenceGraph(unresolved, { purposeContracts: [], businessEvents: [] })).toEqual(unresolved);
  });
});
