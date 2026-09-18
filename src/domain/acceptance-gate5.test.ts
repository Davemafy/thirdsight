import { describe, expect, it } from "vitest";
import type { EvidenceGraphRecord } from "./evidence.js";
import { businessEventEvidence, purposeContractEvidence } from "./evidence-sources.js";
import { enrichEvidenceGraph } from "./evidence-verification.js";
import { decideVerification, verifyObservedFields } from "./deterministic-verifier.js";

const CONTRACT = purposeContractEvidence({
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
}, "gate5:contract:v1");

function flashSaleEvidence(index: number): EvidenceGraphRecord {
  const timestamp = new Date(Date.parse("2026-09-18T12:00:00.000Z") + index * 100).toISOString();
  return {
    recordId: `browser:flash-sale:${index}`,
    observedAt: timestamp,
    integrationId: "analytics-partner",
    integrationResolution: "RESOLVED",
    should: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
    could: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
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
        businessObjectRefs: { orderRefHash: `order-hash-${index}` },
      },
      provenance: [{ source: "browser", sourceId: `flash-sale:${index}`, observedAt: timestamp, confidence: "OBSERVED" }],
    },
    why: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
  } as unknown as EvidenceGraphRecord;
}

describe("Acceptance Gate 5 — flash-sale business-object correlation", () => {
  it("allows a 10x legitimate flash sale because every request matches a first-party business object", () => {
    const baseline = 10;
    const spike = baseline * 10;

    for (let index = 0; index < spike; index += 1) {
      const evidence = flashSaleEvidence(index);
      const event = businessEventEvidence({
        id: `sale-order-${index}`,
        type: "product.viewed",
        timestamp: evidence.observedAt,
        orderRefHash: `order-hash-${index}`,
        integrationId: "analytics-partner",
      });

      const result = enrichEvidenceGraph(evidence, {
        purposeContracts: [CONTRACT],
        businessEvents: [event],
        capabilities: [],
      });

      expect(result.should.status).toBe("KNOWN");
      expect(result.why.status).toBe("KNOWN");
      expect(result.why.value?.correlationStrength).toBe("BUSINESS_OBJECT_HASH");
    }
  });
});


describe("Acceptance Gate 5 — proportional exfiltration during the same sale", () => {
  it("catches object-mismatched abuse even when aggregate request volume still looks legitimate", () => {
    const totalBusinessEvents = 100;
    const abuseCount = 10;
    const events = Array.from({ length: totalBusinessEvents }, (_, index) =>
      businessEventEvidence({
        id: `sale-business-event-${index}`,
        type: "product.viewed",
        timestamp: new Date(Date.parse("2026-09-18T12:30:00.000Z") + index * 100).toISOString(),
        orderRefHash: `sale-order-hash-${index}`,
        integrationId: "analytics-partner",
      }),
    );

    const findings = [];
    for (let index = 0; index < totalBusinessEvents; index += 1) {
      const evidence = flashSaleEvidence(index);
      const mismatched = index >= totalBusinessEvents - abuseCount;
      const withAttackRef = {
        ...evidence,
        observedAt: events[index].event.timestamp,
        did: {
          ...evidence.did,
          value: evidence.did.value
            ? {
                ...evidence.did.value,
                businessObjectRefs: {
                  orderRefHash: mismatched
                    ? `unrelated-order-hash-${index}`
                    : `sale-order-hash-${index}`,
                },
              }
            : null,
        },
      } satisfies EvidenceGraphRecord;

      const enriched = enrichEvidenceGraph(withAttackRef, {
        purposeContracts: [CONTRACT],
        businessEvents: events,
        capabilities: [],
      });
      findings.push(...verifyObservedFields(enriched, ["product.id", "product.category", "product.price"], [CONTRACT]));
    }

    expect(totalBusinessEvents / totalBusinessEvents).toBe(1);
    const purposeMismatch = findings.filter((finding) => (finding.type as string) === "PURPOSE_MISMATCH");
    expect(purposeMismatch).toHaveLength(abuseCount);
    expect(purposeMismatch.every((finding) => finding.action === "CONSTRAIN")).toBe(true);
    expect(decideVerification(purposeMismatch)).toBe("CONSTRAIN");
  });
});
