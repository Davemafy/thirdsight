import type {
  BusinessContextEvidence,
  EvidenceClaim,
  EvidenceGraphRecord,
  PurposeEvidence,
  BrowserCapabilityLowerBound,
} from "./evidence.js";
import type {
  BusinessEventEvidence,
  PurposeContractEvidence,
  CapabilityGrantEvidence,
} from "./evidence-sources.js";

export interface VerificationContext {
  purposeContracts: readonly PurposeContractEvidence[];
  businessEvents: readonly BusinessEventEvidence[];
  capabilities: readonly CapabilityGrantEvidence[];
}

export function enrichEvidenceGraph(
  evidence: EvidenceGraphRecord,
  context: VerificationContext,
): EvidenceGraphRecord {
  if (!evidence.integrationId) return evidence;

  return {
    ...evidence,
    should: projectShould(evidence, context.purposeContracts),
    could: projectCould(evidence, context.capabilities),
    why: projectWhy(evidence, context.businessEvents),
  };
}

function projectShould(
  evidence: EvidenceGraphRecord,
  contracts: readonly PurposeContractEvidence[],
): EvidenceClaim<PurposeEvidence> {
  const active = contracts
    .filter(({ contract }) => contract.integrationId === evidence.integrationId)
    .filter(({ contract }) => isActiveAt(contract.validFrom, contract.expiresAt, evidence.observedAt))
    .sort((a, b) => Date.parse(b.contract.validFrom) - Date.parse(a.contract.validFrom));

  if (active.length === 0) {
    return {
      status: "UNKNOWN",
      confidence: "UNKNOWN",
      value: null,
      provenance: [],
      reason: "No active approved Purpose Contract exists for the resolved integration at observation time.",
    };
  }

  const selected = active[0];
  return {
    status: "KNOWN",
    confidence: "AUTHORITATIVE",
    value: {
      contractId: selected.contract.contractId,
      contractVersion: selected.contract.version,
      purpose: selected.contract.purpose,
      resources: selected.contract.resources,
      fields: selected.contract.fields,
      operations: selected.contract.operations,
      validTriggers: selected.contract.validTriggers,
    },
    provenance: [selected.provenance],
    reason: "Projected from the active approved Purpose Contract; runtime behavior cannot widen this policy.",
  };
}

function projectWhy(
  evidence: EvidenceGraphRecord,
  events: readonly BusinessEventEvidence[],
): EvidenceClaim<BusinessContextEvidence> {
  const observedAt = Date.parse(evidence.observedAt);
  const candidates = events
    .filter(({ event }) => event.integrationId === evidence.integrationId)
    .map((item) => ({ item, delta: observedAt - Date.parse(item.event.timestamp) }))
    .filter(({ delta }) => Number.isFinite(delta) && delta >= 0 && delta <= 5 * 60_000)
    .sort((a, b) => a.delta - b.delta);

  if (candidates.length === 0) {
    return {
      status: "UNKNOWN",
      confidence: "UNKNOWN",
      value: null,
      provenance: [],
      reason: "No trusted first-party BusinessEvent for this integration falls within the bounded correlation window.",
    };
  }

  const selected = candidates[0].item;
  return {
    status: "PARTIAL",
    confidence: "INFERRED",
    value: {
      eventId: selected.event.id,
      eventType: selected.event.type,
      correlationStrength: "TRIGGER_WINDOW",
    },
    provenance: [selected.provenance],
    reason: "A trusted first-party event is temporally correlated, but no shared business-object reference was available.",
  };
}

function isActiveAt(validFrom: string, expiresAt: string | null, observedAt: string): boolean {
  const at = Date.parse(observedAt);
  const from = Date.parse(validFrom);
  if (!Number.isFinite(at) || !Number.isFinite(from) || from > at) return false;
  if (expiresAt === null) return true;
  const until = Date.parse(expiresAt);
  return Number.isFinite(until) && until > at;
}

function projectCould(evidence: EvidenceGraphRecord, capabilities: readonly CapabilityGrantEvidence[]): EvidenceClaim<BrowserCapabilityLowerBound> {
  const active = capabilities.filter(({ capability }) => capability.integrationId === evidence.integrationId).filter(({ capability }) => isActiveAt(capability.validFrom, capability.validTo, evidence.observedAt));
  if (active.length === 0) return evidence.could;
  const selected = active.sort((a,b) => Date.parse(b.capability.validFrom)-Date.parse(a.capability.validFrom))[0];
  return {
    status: "PARTIAL",
    confidence: selected.provenance.confidence,
    value: { kind: "DECLARED_BROWSER_CAPABILITY", destinationOrigin: selected.capability.destinationOrigin, statement: `Configured capability permits fields [${selected.capability.fields.join(", ")}] and operations [${selected.capability.operations.join(", ")}]; this is not proof of transmitted values or the complete technical surface.` },
    provenance: [selected.provenance],
    reason: "Projected from an independently sourced capability grant; capability is kept separate from approved purpose and observed behavior.",
  };
}
