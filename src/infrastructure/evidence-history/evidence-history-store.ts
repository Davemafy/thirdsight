import type { EvidenceGraphRecord } from "../../domain/evidence";
import type {
  IntegrationOriginBinding,
  IntegrationResolutionResult,
} from "../../domain/integration-identity";
import type { BrowserObservationV1 } from "../browser-evidence/browser-evidence-adapter";

export interface EvidenceHistoryEntry {
  recordId: string;
  observationId: string;
  acceptedAt: string;
  observation: BrowserObservationV1;
  evidence: EvidenceGraphRecord;
  integrationResolution: IntegrationResolutionResult;
}

export interface EvidenceHistoryStore {
  findActiveOriginBindings(
    origin: string,
    environment: string,
    observedAt: string,
  ): Promise<readonly IntegrationOriginBinding[]>;

  append(entry: EvidenceHistoryEntry): Promise<void>;

  list(limit?: number): Promise<readonly EvidenceHistoryEntry[]>;
}
