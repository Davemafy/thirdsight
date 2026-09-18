export type EvidenceConfidence =
  | "AUTHORITATIVE"
  | "OBSERVED"
  | "DECLARED"
  | "OBSERVED_LOWER_BOUND"
  | "INFERRED"
  | "UNKNOWN";

export type EvidenceStatus = "KNOWN" | "PARTIAL" | "UNKNOWN";

export type EvidenceSource =
  | "browser"
  | "server-egress"
  | "gateway"
  | "webhook"
  | "db-audit"
  | "credential-registry"
  | "business-event"
  | "purpose-contract"
  | "capability-registry";

export interface EvidenceRef {
  source: EvidenceSource;
  sourceId: string;
  observedAt: string;
  confidence: EvidenceConfidence;
}

export interface EvidenceClaim<T> {
  status: EvidenceStatus;
  confidence: EvidenceConfidence;
  value: T | null;
  provenance: readonly EvidenceRef[];
  reason?: string;
}

export interface PurposeEvidence {
  contractId: string;
  contractVersion: string;
  purpose: string;
  resources?: readonly string[];
  fields?: readonly string[];
  operations?: readonly string[];
  validTriggers?: readonly string[];
}

export interface BrowserCapabilityLowerBound {
  kind: "BROWSER_REQUEST_EXECUTION" | "DECLARED_BROWSER_CAPABILITY";
  destinationOrigin: string;
  statement: string;
}

export interface RuntimeAccessEvidence {
  boundary: "browser" | "server-egress" | "gateway" | "webhook" | "db-audit";
  phase: "ATTEMPTED" | "TRANSMITTED" | "ACCESSED";
  pageOrigin: string | null;
  destinationOrigin: string;
  destinationPath: string;
  method: string;
  resourceType: string;
  initiatorType: string;
  hasPostData: boolean;
  originRelationship: "SAME_ORIGIN" | "CROSS_ORIGIN" | "UNKNOWN";
  dataCategories?: readonly string[];
}

export interface BusinessContextEvidence {
  eventId: string;
  eventType: string;
  correlationStrength:
    | "EXACT_REFERENCE"
    | "BUSINESS_OBJECT_HASH"
    | "TRIGGER_WINDOW"
    | "TEMPORAL_ONLY";
}

export interface EvidenceGraphRecord {
  recordId: string;
  observedAt: string;
  integrationId: string | null;
  integrationResolution: "RESOLVED" | "UNRESOLVED" | "AMBIGUOUS";
  should: EvidenceClaim<PurposeEvidence>;
  could: EvidenceClaim<BrowserCapabilityLowerBound>;
  did: EvidenceClaim<RuntimeAccessEvidence>;
  why: EvidenceClaim<BusinessContextEvidence>;
}
