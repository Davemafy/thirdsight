import type { EvidenceGraphRecord } from "../../domain/evidence.js";
import type {
  IntegrationOriginBinding,
  IntegrationResolutionResult,
} from "../../domain/integration-identity.js";
import type { PurposeContractEvidence, BusinessEventEvidence, CapabilityGrantEvidence } from "../../domain/evidence-sources.js";
import type { VerificationFinding } from "../../domain/deterministic-verifier.js";
import type { BrowserObservationV1 } from "../browser-evidence/browser-evidence-adapter.js";

export interface EnforcementRecord {
  action: "CONSTRAIN" | "ISOLATE";
  outcome: "PREVENTED";
  removedFields: readonly string[];
  continuedFields: readonly string[];
  receiver: {
    receivedFields: readonly string[];
    forbiddenFieldReceived: boolean;
  };
}

export interface EvidenceHistoryEntry {
  recordId: string;
  observationId: string;
  acceptedAt: string;
  observation: BrowserObservationV1;
  evidence: EvidenceGraphRecord;
  integrationResolution: IntegrationResolutionResult;
  findings?: readonly VerificationFinding[];
  enforcement?: EnforcementRecord | null;
  outcome?: "PREVENTED" | "DETECTED" | null;
}

export interface EvidenceHistoryStore {
  findActiveOriginBindings(
    origin: string,
    environment: string,
    observedAt: string,
  ): Promise<readonly IntegrationOriginBinding[]>;

  findPurposeContracts(integrationId: string, environment: string, observedAt: string): Promise<readonly PurposeContractEvidence[]>;
  findCapabilities(integrationId: string, environment: string, observedAt: string): Promise<readonly CapabilityGrantEvidence[]>;
  findBusinessEvents(integrationId: string, observedAt: string): Promise<readonly BusinessEventEvidence[]>;

  appendBusinessEvent(event: BusinessEventEvidence): Promise<void>;

  append(entry: EvidenceHistoryEntry): Promise<void>;

  list(limit?: number): Promise<readonly EvidenceHistoryEntry[]>;
}
