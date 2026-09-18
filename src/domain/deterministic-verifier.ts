import type { EvidenceGraphRecord } from "./evidence.js";
import type { PurposeContractEvidence } from "./evidence-sources.js";

export type FindingType = "SCOPE_DRIFT";
export type VerificationAction = "ALLOW" | "OBSERVE" | "CONSTRAIN" | "ISOLATE";

export interface VerificationFinding {
  type: FindingType;
  action: VerificationAction;
  evidenceRecordId: string;
  integrationId: string;
  field: string;
  contractId: string;
  contractVersion: string;
  reason: string;
}

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
  return [...new Set(observedFields)]
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
}


export function decideVerification(findings: readonly VerificationFinding[]): VerificationAction {
  if (findings.some((finding) => finding.action === "ISOLATE")) return "ISOLATE";
  if (findings.some((finding) => finding.action === "CONSTRAIN")) return "CONSTRAIN";
  if (findings.some((finding) => finding.action === "OBSERVE")) return "OBSERVE";
  return "ALLOW";
}
