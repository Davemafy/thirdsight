import { describe, expect, it } from "vitest";
import type { EvidenceGraphRecord } from "./evidence.js";
import { decideVerification, verifyIntegrationLifecycle } from "./deterministic-verifier.js";

describe("Stage 7 — stale CRM direct database access", () => {
  it("isolates a retired integration when DB audit proves the old credential still accessed customer data", () => {
    const evidence: EvidenceGraphRecord = {
      recordId: "db-audit:legacy-crm:read-1",
      observedAt: "2026-09-18T12:40:00.000Z",
      integrationId: "legacy-crm",
      integrationResolution: "RESOLVED",
      should: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [], reason: "Retired integration has no active purpose contract." },
      could: { status: "PARTIAL", confidence: "OBSERVED_LOWER_BOUND", value: null, provenance: [] },
      did: {
        status: "KNOWN",
        confidence: "OBSERVED",
        value: {
          boundary: "db-audit",
          phase: "ACCESSED",
          pageOrigin: null,
          destinationOrigin: "postgres://commerce-lab",
          destinationPath: "public.customers",
          method: "SELECT",
          resourceType: "Database",
          initiatorType: "credential",
          hasPostData: false,
          originRelationship: "UNKNOWN",
          dataCategories: ["customer.email", "customer.phone"],
        },
        provenance: [{ source: "db-audit", sourceId: "db-audit:read-1", observedAt: "2026-09-18T12:40:00.000Z", confidence: "OBSERVED" }],
      },
      why: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
      coverage: { label: "MULTI_BOUNDARY", boundaries: ["db-audit"], limitations: ["No gateway request was observed for this direct database path."] },
    };

    const findings = verifyIntegrationLifecycle(evidence, {
      integrationId: "legacy-crm",
      displayName: "Legacy CRM",
      lifecycleStatus: "RETIRED",
      owner: "Commerce Ops",
      credentialId: "legacy-crm-db",
    });

    expect(findings).toEqual([
      expect.objectContaining({
        type: "STALE_INTEGRATION",
        action: "ISOLATE",
        integrationId: "legacy-crm",
      }),
    ]);
    expect(decideVerification(findings)).toBe("ISOLATE");
  });
});
