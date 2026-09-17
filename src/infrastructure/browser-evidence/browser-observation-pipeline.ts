import {
  resolveIntegrationIdentity,
  type IntegrationResolutionResult,
} from "../../domain/integration-identity";
import type { EvidenceHistoryEntry, EvidenceHistoryStore } from "../evidence-history/evidence-history-store";
import {
  ingestBrowserObservation,
  type BrowserObservationIngestionResult,
} from "./browser-observation-ingestion";

export interface DurableBrowserObservationResult extends BrowserObservationIngestionResult {
  integrationResolution: IntegrationResolutionResult;
  persisted: true;
}

export async function ingestAndPersistBrowserObservation(
  input: unknown,
  store: EvidenceHistoryStore,
  environment: string,
  acceptedAt = new Date().toISOString(),
): Promise<DurableBrowserObservationResult> {
  if (environment.trim().length === 0) {
    throw new Error("ThirdSight environment is required for durable ingestion.");
  }

  const base = ingestBrowserObservation(input, acceptedAt);
  const destinationOrigin = base.evidence.did.value?.destinationOrigin;
  const bindings = destinationOrigin
    ? await store.findActiveOriginBindings(
        destinationOrigin,
        environment,
        base.observation.observedAt,
      )
    : [];

  const resolved = resolveIntegrationIdentity(base.evidence, bindings, environment);
  const entry: EvidenceHistoryEntry = {
    recordId: resolved.evidence.recordId,
    observationId: base.observation.observationId,
    acceptedAt,
    observation: base.observation,
    evidence: resolved.evidence,
    integrationResolution: resolved.resolution,
  };

  await store.append(entry);

  return {
    acceptedAt,
    observation: base.observation,
    evidence: resolved.evidence,
    integrationResolution: resolved.resolution,
    persisted: true,
  };
}
