import { describe, expect, it } from "vitest";
import type { EvidenceGraphRecord } from "./evidence.js";
import { decideVerification, verifyShadowIntegration } from "./deterministic-verifier.js";

describe("Stage 7 — opaque shadow integration", () => {
  it("flags an unregistered cross-origin integration in managed Commerce Lab without inventing payload semantics", () => {
    const evidence: EvidenceGraphRecord = {
      recordId: "browser:commerce-lab:shadow:1",
      observedAt: "2026-09-18T13:00:00.000Z",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      should: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [], reason: "No registered integration supplies SHOULD." },
      could: {
        status: "PARTIAL",
        confidence: "OBSERVED_LOWER_BOUND",
        value: {
          kind: "BROWSER_REQUEST_EXECUTION",
          destinationOrigin: "https://shadowpixel.invalid",
          statement: "Browser execution is only a lower bound.",
        },
        provenance: [{ source: "browser", sourceId: "shadow:1", observedAt: "2026-09-18T13:00:00.000Z", confidence: "OBSERVED_LOWER_BOUND" }],
      },
      did: {
        status: "KNOWN",
        confidence: "OBSERVED",
        value: {
          boundary: "browser",
          phase: "ATTEMPTED",
          pageOrigin: "https://commerce-lab.example",
          destinationOrigin: "https://shadowpixel.invalid",
          destinationPath: "/pixel",
          method: "POST",
          resourceType: "Fetch",
          initiatorType: "script",
          hasPostData: true,
          originRelationship: "CROSS_ORIGIN",
        },
        provenance: [{ source: "browser", sourceId: "shadow:1", observedAt: "2026-09-18T13:00:00.000Z", confidence: "OBSERVED" }],
      },
      why: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
      coverage: { label: "BROWSER_ONLY", boundaries: ["browser"], limitations: ["Payload semantics are opaque."] },
    };

    const findings = verifyShadowIntegration(evidence, {
      managedEnvironment: true,
      integrationInventoryComplete: true,
    });

    expect(findings).toEqual([
      expect.objectContaining({
        type: "SHADOW_INTEGRATION",
        action: "OBSERVE",
      }),
    ]);
    expect(decideVerification(findings)).toBe("OBSERVE");
    expect(evidence.did.value?.dataCategories).toBeUndefined();
  });
});
