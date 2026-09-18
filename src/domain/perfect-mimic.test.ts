import { describe, expect, it } from "vitest";
import type { EvidenceGraphRecord } from "./evidence.js";
import { purposeContractEvidence } from "./evidence-sources.js";
import { decideVerification, verifyObservedFields } from "./deterministic-verifier.js";
import { assessPerfectMimicBlindSpot } from "./blind-spot-assessment.js";

describe("Stage 7 — perfect mimic known blind spot", () => {
  it("explicitly records that purpose-consistent credential compromise is not detectable from identical evidence", () => {
    const contract = purposeContractEvidence({
      contractId: "analytics-product-view",
      integrationId: "analytics-partner",
      version: "5",
      purpose: "Measure product interest with loyalty segmentation",
      resources: ["analytics.events"],
      fields: ["product.id", "product.category", "product.price", "customer.loyalty_tier"],
      operations: ["send"],
      validTriggers: ["product.viewed"],
      environment: "production",
      validFrom: "2026-09-18T11:00:00.000Z",
      reviewAt: "2026-10-18T11:00:00.000Z",
      expiresAt: null,
      owner: "commerce",
      approvedBy: "privacy",
      changeReason: "Approved loyalty segmentation field",
    }, "contract:v5");

    const evidence: EvidenceGraphRecord = {
      recordId: "browser:perfect-mimic:1",
      observedAt: "2026-09-18T11:15:00.000Z",
      integrationId: "analytics-partner",
      integrationResolution: "RESOLVED",
      should: {
        status: "KNOWN",
        confidence: "AUTHORITATIVE",
        value: {
          contractId: contract.contract.contractId,
          contractVersion: contract.contract.version,
          purpose: contract.contract.purpose,
          resources: contract.contract.resources,
          fields: contract.contract.fields,
          operations: contract.contract.operations,
          validTriggers: contract.contract.validTriggers,
        },
        provenance: [contract.provenance],
      },
      could: {
        status: "PARTIAL",
        confidence: "DECLARED",
        value: {
          kind: "DECLARED_BROWSER_CAPABILITY",
          destinationOrigin: "https://analytics.example",
          statement: "Configured capability includes the approved analytics fields.",
        },
        provenance: [{ source: "capability-registry", sourceId: "cap:analytics", observedAt: "2026-09-18T11:00:00.000Z", confidence: "DECLARED" }],
      },
      did: {
        status: "KNOWN",
        confidence: "OBSERVED",
        value: {
          boundary: "browser",
          phase: "ATTEMPTED",
          pageOrigin: "https://commerce-lab.example",
          destinationOrigin: "https://analytics.example",
          destinationPath: "/collect",
          method: "POST",
          resourceType: "Fetch",
          initiatorType: "script",
          hasPostData: true,
          originRelationship: "CROSS_ORIGIN",
          dataCategories: ["product.id", "product.category", "product.price"],
          businessObjectRefs: { orderRefHash: "perfect-mimic-order" },
        },
        provenance: [{ source: "browser", sourceId: "perfect-mimic:1", observedAt: "2026-09-18T11:15:00.000Z", confidence: "OBSERVED" }],
      },
      why: {
        status: "KNOWN",
        confidence: "OBSERVED",
        value: {
          eventId: "product-view-perfect-mimic",
          eventType: "product.viewed",
          correlationStrength: "BUSINESS_OBJECT_HASH",
        },
        provenance: [{ source: "business-event", sourceId: "product-view-perfect-mimic", observedAt: "2026-09-18T11:15:00.000Z", confidence: "AUTHORITATIVE" }],
      },
    };

    const findings = verifyObservedFields(
      evidence,
      ["product.id", "product.category", "product.price"],
      [contract],
    );
    expect(findings).toEqual([]);
    expect(decideVerification(findings)).toBe("ALLOW");

    const blindSpot = assessPerfectMimicBlindSpot(evidence, findings);
    expect(blindSpot).toMatchObject({
      reasonCode: "PERFECT_MIMIC_UNDETECTABLE",
      detectable: false,
      detectorDecision: "ALLOW",
    });
  });
});
