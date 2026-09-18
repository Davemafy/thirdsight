import type { EvidenceGraphRecord } from "./evidence.js";
import type { PurposeContractEvidence } from "./evidence-sources.js";
import { verifyObservedFields } from "./deterministic-verifier.js";
import { constrainManagedPayload, type ManagedPayload, type PreventionResult } from "./managed-enforcement.js";

export interface ManagedVerificationInput {
  evidence: EvidenceGraphRecord;
  semanticPayload: ManagedPayload;
  observedFields: readonly string[];
  purposeContracts: readonly PurposeContractEvidence[];
}

export function verifyAndConstrainManagedRequest(input: ManagedVerificationInput): PreventionResult {
  const findings = verifyObservedFields(input.evidence, input.observedFields, input.purposeContracts);
  return constrainManagedPayload(input.semanticPayload, findings);
}
