import { describe, expect, it } from "vitest";
import type { EvidenceGraphRecord } from "../domain/evidence.js";
import {
  buildAiAnalystInput,
  enforceAiAuthority,
  isAiEligibleAmbiguity,
  type AiAnalystAssessment,
} from "./ai-analyst.js";

const ambiguousEvidence: EvidenceGraphRecord = {
  recordId: "browser:stage8:ambiguous-1",
  observedAt: "2026-09-18T12:00:00.000Z",
  integrationId: null,
  integrationResolution: "UNRESOLVED",
  should: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [], reason: "No Purpose Contract provided." },
  could: {
    status: "PARTIAL",
    confidence: "OBSERVED_LOWER_BOUND",
    value: {
      kind: "BROWSER_REQUEST_EXECUTION",
      destinationOrigin: "https://telemetry.example",
      statement: "Browser execution proves only a lower bound.",
    },
    provenance: [{ source: "browser", sourceId: "raw-id-should-not-leave-boundary", observedAt: "2026-09-18T12:00:00.000Z", confidence: "OBSERVED_LOWER_BOUND" }],
  },
  did: {
    status: "KNOWN",
    confidence: "OBSERVED",
    value: {
      boundary: "browser",
      phase: "ATTEMPTED",
      pageOrigin: "https://commerce-lab.example",
      destinationOrigin: "https://telemetry.example",
      destinationPath: "/collect",
      method: "POST",
      resourceType: "Fetch",
      initiatorType: "script",
      hasPostData: true,
      originRelationship: "CROSS_ORIGIN",
      dataCategories: ["customer.phone"],
      businessObjectRefs: { orderRefHash: "secret-hash-must-not-be-sent" },
    },
    provenance: [{ source: "browser", sourceId: "raw-browser-id", observedAt: "2026-09-18T12:00:00.000Z", confidence: "OBSERVED" }],
  },
  why: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [], reason: "No first-party business event correlated." },
  coverage: {
    label: "BROWSER_ONLY",
    boundaries: ["browser"],
    limitations: ["Backend permissions and downstream behavior are not visible."],
  },
};

describe("Stage 8 — AI analyst authority boundary", () => {
  it("routes only genuinely ambiguous evidence to AI", () => {
    expect(isAiEligibleAmbiguity(ambiguousEvidence, "OBSERVE")).toBe(true);
  });

  it("builds a structured PII-minimized analyst input without raw values or object hashes", () => {
    const input = buildAiAnalystInput(ambiguousEvidence, "OBSERVE", []);
    const serialized = JSON.stringify(input);
    expect(serialized).not.toContain("secret-hash-must-not-be-sent");
    expect(serialized).not.toContain("raw-browser-id");
    expect(serialized).not.toContain("raw-id-should-not-leave-boundary");
    expect(input.did.dataCategories).toEqual(["customer.phone"]);
    expect(input.did.hasBusinessObjectReference).toBe(true);
  });

  it("rejects any AI attempt to independently constrain or isolate", () => {
    const forbidden = {
      assessment: "NEEDS_REVIEW",
      evidence_used: ["did.status"],
      unsupported_assumptions: [],
      confidence: "HIGH",
      recommended_response: "ISOLATE",
      explanation: "Isolate the integration.",
    } as unknown as AiAnalystAssessment;

    expect(() => enforceAiAuthority(forbidden, new Set(["did.status"]))).toThrow();
  });
});
