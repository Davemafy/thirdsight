import type { EvidenceGraphRecord } from "./evidence.js";
import type { PurposeContractEvidence } from "./evidence-sources.js";

export type FindingType = "SCOPE_DRIFT" | "PURPOSE_MISMATCH" | "STALE_INTEGRATION" | "SHADOW_INTEGRATION";
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

export interface StaleIntegrationFinding {
  type: "STALE_INTEGRATION";
  action: "ISOLATE";
  evidenceRecordId: string;
  integrationId: string;
  credentialId?: string;
  reason: string;
}

export interface ShadowIntegrationFinding {
  type: "SHADOW_INTEGRATION";
  action: "OBSERVE";
  evidenceRecordId: string;
  integrationId: null;
  destinationOrigin: string;
  reason: string;
}

export type VerificationFinding = ScopeDriftFinding | PurposeMismatchFinding | StaleIntegrationFinding | ShadowIntegrationFinding;

export interface IntegrationLifecycleState {
  integrationId: string;
  displayName: string;
  lifecycleStatus: "ACTIVE" | "RETIRED";
  owner?: string | null;
  credentialId?: string;
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


export function verifyIntegrationLifecycle(
  evidence: EvidenceGraphRecord,
  integration: IntegrationLifecycleState,
): readonly VerificationFinding[] {
  if (evidence.integrationId !== integration.integrationId) return [];
  if (integration.lifecycleStatus !== "RETIRED") return [];
  const did = evidence.did.value;
  if (evidence.did.status !== "KNOWN" || !did || did.phase !== "ACCESSED") return [];

  return [{
    type: "STALE_INTEGRATION",
    action: "ISOLATE",
    evidenceRecordId: evidence.recordId,
    integrationId: integration.integrationId,
    ...(integration.credentialId ? { credentialId: integration.credentialId } : {}),
    reason:
      `${integration.displayName} is retired, but runtime evidence shows access after retirement through the ${did.boundary} boundary. The observed access is historical evidence; isolation contains future use and is not described as preventing the access already seen.`,
  }];
}


export function verifyShadowIntegration(
  evidence: EvidenceGraphRecord,
  context: { managedEnvironment: boolean; integrationInventoryComplete: boolean },
): readonly VerificationFinding[] {
  if (!context.managedEnvironment || !context.integrationInventoryComplete) return [];
  if (evidence.integrationResolution !== "UNRESOLVED" || evidence.integrationId !== null) return [];
  const did = evidence.did.value;
  if (evidence.did.status !== "KNOWN" || !did) return [];
  if (did.boundary !== "browser" || did.originRelationship !== "CROSS_ORIGIN") return [];

  return [{
    type: "SHADOW_INTEGRATION",
    action: "OBSERVE",
    evidenceRecordId: evidence.recordId,
    integrationId: null,
    destinationOrigin: did.destinationOrigin,
    reason:
      "A managed Commerce Lab browser session reached a cross-origin destination that has no valid registered integration identity. Payload semantics remain unknown, so ThirdSight observes and requests review rather than inventing data categories or claiming malicious intent.",
  }];
}
