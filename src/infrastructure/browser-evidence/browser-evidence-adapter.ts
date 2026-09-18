import type {
  BrowserCapabilityLowerBound,
  EvidenceClaim,
  EvidenceGraphRecord,
  EvidenceRef,
  RuntimeAccessEvidence,
} from "../../domain/evidence.js";

export interface BrowserObservationV1 {
  schemaVersion: "browser-observation.v1";
  observationId: string;
  sensorId: string;
  observedAt: string;
  pageUrl: string | null;
  destinationUrl: string;
  method: string;
  resourceType: string;
  initiatorType: string;
  hasPostData: boolean;
}

export class BrowserObservationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserObservationValidationError";
  }
}

export function parseBrowserObservation(input: unknown): BrowserObservationV1 {
  if (!isRecord(input)) {
    throw new BrowserObservationValidationError("Browser observation must be an object.");
  }
  if (input.schemaVersion !== "browser-observation.v1") {
    throw new BrowserObservationValidationError("Unsupported browser observation schema version.");
  }
  const observationId = readNonEmptyString(input, "observationId");
  const sensorId = readNonEmptyString(input, "sensorId");
  const observedAt = readIsoTimestamp(input, "observedAt");
  const destinationUrl = readHttpUrl(input, "destinationUrl");
  const pageUrl = readNullableHttpUrl(input, "pageUrl");
  const method = readNonEmptyString(input, "method").toUpperCase();
  const resourceType = readNonEmptyString(input, "resourceType");
  const initiatorType = readNonEmptyString(input, "initiatorType");
  const hasPostData = readBoolean(input, "hasPostData");
  return { schemaVersion: "browser-observation.v1", observationId, sensorId, observedAt, pageUrl, destinationUrl, method, resourceType, initiatorType, hasPostData };
}

export function projectBrowserObservationToEvidenceGraph(input: unknown): EvidenceGraphRecord {
  const observation = parseBrowserObservation(input);
  const destination = new URL(observation.destinationUrl);
  const page = observation.pageUrl ? new URL(observation.pageUrl) : null;
  const pageOrigin = page?.origin ?? null;
  const destinationOrigin = destination.origin;
  const originRelationship = pageOrigin ? (pageOrigin === destinationOrigin ? "SAME_ORIGIN" : "CROSS_ORIGIN") : "UNKNOWN";
  const observedProvenance: EvidenceRef = { source: "browser", sourceId: `${observation.sensorId}:${observation.observationId}`, observedAt: observation.observedAt, confidence: "OBSERVED" };
  const lowerBoundProvenance: EvidenceRef = { ...observedProvenance, confidence: "OBSERVED_LOWER_BOUND" };
  const did: RuntimeAccessEvidence = { boundary: "browser", phase: "ATTEMPTED", pageOrigin, destinationOrigin, destinationPath: destination.pathname, method: observation.method, resourceType: observation.resourceType, initiatorType: observation.initiatorType, hasPostData: observation.hasPostData, originRelationship };
  const could: BrowserCapabilityLowerBound = { kind: "BROWSER_REQUEST_EXECUTION", destinationOrigin, statement: "The browser runtime executed an outbound request toward this destination. This is only a lower bound on technical capability and does not establish the complete permission surface." };
  return {
    recordId: `browser:${observation.sensorId}:${observation.observationId}`,
    observedAt: observation.observedAt,
    integrationId: null,
    integrationResolution: "UNRESOLVED",
    should: unknownClaim("No merchant Purpose Contract is supplied by passive browser observation."),
    could: { status: "PARTIAL", confidence: "OBSERVED_LOWER_BOUND", value: could, provenance: [lowerBoundProvenance], reason: "Observed request execution proves only a browser-visible lower bound, not the integration's full technical access surface." },
    did: { status: "KNOWN", confidence: "OBSERVED", value: did, provenance: [observedProvenance] },
    why: unknownClaim("No trusted first-party business event is correlated by passive browser observation."),
  };
}

function unknownClaim<T>(reason: string): EvidenceClaim<T> { return { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [], reason }; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function readNonEmptyString(record: Record<string, unknown>, key: string): string { const value = record[key]; if (typeof value !== "string" || value.trim().length === 0) throw new BrowserObservationValidationError(`${key} must be a non-empty string.`); return value; }
function readBoolean(record: Record<string, unknown>, key: string): boolean { const value = record[key]; if (typeof value !== "boolean") throw new BrowserObservationValidationError(`${key} must be a boolean.`); return value; }
function readIsoTimestamp(record: Record<string, unknown>, key: string): string { const value = readNonEmptyString(record, key); if (Number.isNaN(Date.parse(value))) throw new BrowserObservationValidationError(`${key} must be an ISO timestamp.`); return value; }
function readHttpUrl(record: Record<string, unknown>, key: string): string { const value = readNonEmptyString(record, key); assertHttpUrl(value, key); return value; }
function readNullableHttpUrl(record: Record<string, unknown>, key: string): string | null { const value = record[key]; if (value === null) return null; if (typeof value !== "string" || value.trim().length === 0) throw new BrowserObservationValidationError(`${key} must be null or a non-empty http(s) URL.`); assertHttpUrl(value, key); return value; }
function assertHttpUrl(value: string, key: string): void { let parsed: URL; try { parsed = new URL(value); } catch { throw new BrowserObservationValidationError(`${key} must be a valid URL.`); } if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new BrowserObservationValidationError(`${key} must use http or https.`); }
