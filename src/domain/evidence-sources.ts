import type { EvidenceRef } from "./evidence.js";

export interface PurposeContract {
  contractId: string;
  integrationId: string;
  version: string;
  purpose: string;
  resources: readonly string[];
  fields: readonly string[];
  operations: readonly string[];
  validTriggers: readonly string[];
  environment: string;
  validFrom: string;
  reviewAt: string;
  expiresAt: string | null;
  owner: string;
  approvedBy: string;
  changeReason: string;
}

export interface BusinessEvent {
  id: string;
  type: string;
  timestamp: string;
  customerRefHash?: string;
  orderRefHash?: string;
  paymentRefHash?: string;
  deliveryRefHash?: string;
  campaignRef?: string;
  integrationId?: string;
}

export interface PurposeContractEvidence {
  contract: PurposeContract;
  provenance: EvidenceRef;
}

export interface BusinessEventEvidence {
  event: BusinessEvent;
  provenance: EvidenceRef;
}

export function purposeContractEvidence(
  contract: PurposeContract,
  sourceId: string,
): PurposeContractEvidence {
  return {
    contract,
    provenance: {
      source: "purpose-contract",
      sourceId,
      observedAt: contract.validFrom,
      confidence: "AUTHORITATIVE",
    },
  };
}

export function businessEventEvidence(
  event: BusinessEvent,
  sourceId = event.id,
): BusinessEventEvidence {
  return {
    event,
    provenance: {
      source: "business-event",
      sourceId,
      observedAt: event.timestamp,
      confidence: "AUTHORITATIVE",
    },
  };
}

export interface CapabilityGrant {
  capabilityId: string;
  integrationId: string;
  environment: string;
  destinationOrigin: string;
  resources: readonly string[];
  fields: readonly string[];
  operations: readonly string[];
  validFrom: string;
  validTo: string | null;
  authority: "AUTHORITATIVE" | "DECLARED";
}

export interface CapabilityGrantEvidence {
  capability: CapabilityGrant;
  provenance: EvidenceRef;
}

export function capabilityGrantEvidence(capability: CapabilityGrant, sourceId = capability.capabilityId): CapabilityGrantEvidence {
  return { capability, provenance: { source: "capability-registry", sourceId, observedAt: capability.validFrom, confidence: capability.authority } };
}

export function activePurposeContractsFor(integrationId: string, environment: string, observedAt: string, contracts: readonly PurposeContractEvidence[]): readonly PurposeContractEvidence[] {
  return contracts.filter(({contract}) => contract.integrationId === integrationId && contract.environment === environment && activeAt(contract.validFrom, contract.expiresAt, observedAt));
}

export function activeCapabilitiesFor(integrationId: string, environment: string, observedAt: string, capabilities: readonly CapabilityGrantEvidence[]): readonly CapabilityGrantEvidence[] {
  return capabilities.filter(({capability}) => capability.integrationId === integrationId && capability.environment === environment && activeAt(capability.validFrom, capability.validTo, observedAt));
}

function activeAt(from: string, to: string | null, at: string): boolean {
  const t=Date.parse(at), start=Date.parse(from); if(!Number.isFinite(t)||!Number.isFinite(start)||start>t) return false;
  if(to===null) return true; const end=Date.parse(to); return Number.isFinite(end)&&end>t;
}
