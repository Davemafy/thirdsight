import type { EvidenceGraphRecord } from "./evidence.js";
import type { VerificationFinding } from "./deterministic-verifier.js";
import { decideVerification } from "./deterministic-verifier.js";

export interface BlindSpotAssessment {
  reasonCode: "PERFECT_MIMIC_UNDETECTABLE";
  detectable: false;
  detectorDecision: "ALLOW";
  reason: string;
}

export function assessPerfectMimicBlindSpot(
  evidence: EvidenceGraphRecord,
  findings: readonly VerificationFinding[],
): BlindSpotAssessment {
  const decision = decideVerification(findings);
  const purposeConsistent =
    evidence.should.status === "KNOWN" &&
    evidence.did.status === "KNOWN" &&
    evidence.why.status === "KNOWN";

  if (decision !== "ALLOW" || !purposeConsistent) {
    throw new Error("Perfect-mimic blind-spot assessment requires purpose-consistent evidence with an ALLOW decision.");
  }

  return {
    reasonCode: "PERFECT_MIMIC_UNDETECTABLE",
    detectable: false,
    detectorDecision: "ALLOW",
    reason:
      "This benchmark assumes the actor or credential behind a request is compromised while the observable request remains consistent with the approved purpose, capability, runtime behavior, and first-party business context. ThirdSight cannot distinguish that hidden compromise from a legitimate request using these evidence sources alone.",
  };
}
