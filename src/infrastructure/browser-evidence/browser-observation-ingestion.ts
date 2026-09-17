import type { EvidenceGraphRecord } from "../../domain/evidence";
import {
  parseBrowserObservation,
  projectBrowserObservationToEvidenceGraph,
  type BrowserObservationV1,
} from "./browser-evidence-adapter";

export interface BrowserObservationIngestionResult {
  acceptedAt: string;
  observation: BrowserObservationV1;
  evidence: EvidenceGraphRecord;
}

export function ingestBrowserObservation(
  input: unknown,
  acceptedAt = new Date().toISOString(),
): BrowserObservationIngestionResult {
  const observation = parseBrowserObservation(input);
  const evidence = projectBrowserObservationToEvidenceGraph(observation);

  return {
    acceptedAt,
    observation,
    evidence,
  };
}
