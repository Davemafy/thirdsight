import type { EvidenceGraphRecord } from "./evidence.js";
import type { PurposeContractEvidence } from "./evidence-sources.js";

export type FindingType = "SCOPE_DRIFT" | "PURPOSE_MISMATCH";
export type VerificationAction = "ALLOW" | "OBSERVE" | "CONSTRAIN" | "ISOLATE";

export interface ScopeDriftFinding {
  type: "SCOPE_DRIFT";
  action: "CONSTRAIN";
  evidenceRecordId: string;
  integrationId: string;
  field: string;
  contractId: string;
  contractVersion: string;
  reason: string;
}

export interface PurposeMismatchFinding {
  type: "PURPOSE_MISMATCH";
  action: "CONSTRAIN";
  evidenceRecordId: string;
  integrationId: string;
  contractId: string;
  contractVersion: string;
  reason: string;
}

export type VerificationFinding = ScopeDriftFinding | PurposeMismatchFinding;

export function verifyObservedFields(
  evidence: EvidenceGraphRecord,
  observedFields: readonly string[],
  contracts: readonly PurposeContractEvidence[],
): readonly VerificationFinding[] {
  if (!evidence.integrationId || evidence.should.status !== "KNOWN" || !evidence.should.value) return [];
  const contract = contracts.find(({contract}) =>
    contract.integrationId === evidence.integrationId &&
    contract.contractId === evidence.should.value?.contractId &&
    contract.version === evidence.should.value?.contractVersion
  );
  if (!contract) return [];

  const allowed = new Set(contract.contract.fields);
  const findings: VerificationFinding[] = [...new Set(observedFields)]
    .filter((field) => !allowed.has(field))
    .map((field) => ({
      type: "SCOPE_DRIFT" as const,
      action: "CONSTRAIN" as const,
      evidenceRecordId: evidence.recordId,
      integrationId: evidence.integrationId!,
      field,
      contractId: contract.contract.contractId,
      contractVersion: contract.contract.version,
      reason: `${field} was observed at the managed boundary but is absent from Purpose Contract ${contract.contract.contractId} v${contract.contract.version}.`,
    }));

  const objectRefs = evidence.did.value?.businessObjectRefs;
  const hasObjectRef = Boolean(objectRefs && Object.values(objectRefs).some((value) => typeof value === "string" && value.length > 0));
  const hasNearbyFirstPartyEvidence = evidence.why.status === "UNKNOWN" && evidence.why.provenance.length > 0;
  if (hasObjectRef && hasNearbyFirstPartyEvidence) {
    findings.push({
      type: "PURPOSE_MISMATCH",
      action: "CONSTRAIN",
      evidenceRecordId: evidence.recordId,
      integrationId: evidence.integrationId,
      contractId: contract.contract.contractId,
      contractVersion: contract.contract.version,
      reason: "The managed request carried a business-object reference that did not match any trusted first-party BusinessEvent in the bounded correlation window. Nearby sale volume is not accepted as justification for an unrelated object.",
    });
  }

  return findings;
}


export function decideVerification(findings: readonly VerificationFinding[]): VerificationAction {
  const actions = findings.map((finding) => finding.action as VerificationAction);
  if (actions.includes("ISOLATE")) return "ISOLATE";
  if (actions.includes("CONSTRAIN")) return "CONSTRAIN";
  if (actions.includes("OBSERVE")) return "OBSERVE";
  return "ALLOW";
}
