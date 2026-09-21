import type { EvidenceGraphRecord } from "../../domain/evidence.js";
import type {
  IntegrationOriginBinding,
  IntegrationResolutionResult,
} from "../../domain/integration-identity.js";
import type { PurposeContractEvidence, BusinessEventEvidence, CapabilityGrantEvidence } from "../../domain/evidence-sources.js";
import type { VerificationAction, VerificationFinding } from "../../domain/deterministic-verifier.js";
import type { BlindSpotAssessment } from "../../domain/blind-spot-assessment.js";
import type { BrowserObservationV1 } from "../browser-evidence/browser-evidence-adapter.js";
import type { DbAuditObservationV1 } from "../db-audit/db-audit-adapter.js";
import type { GatewayObservationV1 } from "../gateway/gateway-observation.js";
import type { ManagedHttpObservationV1 } from "../gateway/managed-http-observation.js";

export interface EnforcementRecord {
  action: "CONSTRAIN" | "ISOLATE";
  outcome: "PREVENTED";
  removedFields: readonly string[];
  continuedFields: readonly string[];
  receiver?: {
    receivedFields: readonly string[];
    forbiddenFieldReceived: boolean;
  };
  forwarding?: {
    upstreamContacted: boolean | null;
    transmittedFields: readonly string[];
    upstreamStatus: number | null;
  };
}

export type EvidenceObservation = BrowserObservationV1 | DbAuditObservationV1 | GatewayObservationV1 | ManagedHttpObservationV1;

export interface ContainmentRecord {
  action: "ISOLATE";
  credentialId: string;
  applied: boolean;
}

export interface EvidenceHistoryEntry {
  recordId: string;
  observationId: string;
  acceptedAt: string;
  observation: EvidenceObservation;
  evidence: EvidenceGraphRecord;
  integrationResolution: IntegrationResolutionResult;
  findings?: readonly VerificationFinding[];
  enforcement?: EnforcementRecord | null;
  outcome?: "PREVENTED" | "DETECTED" | null;
  decision?: VerificationAction;
  containment?: ContainmentRecord | null;
  blindSpotAssessment?: BlindSpotAssessment | null;
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
  findIntegrationLifecycle(integrationId: string): Promise<import("../../domain/deterministic-verifier.js").IntegrationLifecycleState | null>;
  findCredential(credentialId: string): Promise<{ credentialId: string; integrationId: string; status: "ACTIVE" | "REVOKED"; environment: string } | null>;
  registerCredential(input: { credentialId: string; integrationId: string; environment: string; validFrom: string }): Promise<void>;
  isolateCredential(credentialId: string): Promise<boolean>;

  appendBusinessEvent(event: BusinessEventEvidence): Promise<void>;
  appendBusinessEvents(events: readonly BusinessEventEvidence[]): Promise<void>;

  append(entry: EvidenceHistoryEntry): Promise<void>;
  appendMany(entries: readonly EvidenceHistoryEntry[]): Promise<void>;

  list(limit?: number): Promise<readonly EvidenceHistoryEntry[]>;
}
