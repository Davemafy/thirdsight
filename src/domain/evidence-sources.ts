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
