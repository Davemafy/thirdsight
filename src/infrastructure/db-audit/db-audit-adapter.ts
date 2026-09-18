import type { EvidenceGraphRecord, EvidenceRef } from "../../domain/evidence.js";

export interface DbAuditObservationV1 {
  schemaVersion: "db-audit-observation.v1";
  observationId: string;
  sensorId: string;
  observedAt: string;
  integrationId: string;
  credentialId: string;
  database: string;
  resource: string;
  operation: string;
  dataCategories: readonly string[];
}

export function projectDbAuditObservationToEvidenceGraph(input: DbAuditObservationV1): EvidenceGraphRecord {
  const provenance: EvidenceRef = {
    source: "db-audit",
    sourceId: `${input.sensorId}:${input.observationId}`,
    observedAt: input.observedAt,
    confidence: "OBSERVED",
  };

  return {
    recordId: `db-audit:${input.sensorId}:${input.observationId}`,
    observedAt: input.observedAt,
    integrationId: input.integrationId,
    integrationResolution: "RESOLVED",
    should: {
      status: "UNKNOWN",
      confidence: "UNKNOWN",
      value: null,
      provenance: [],
      reason: "Database audit evidence does not supply an active merchant Purpose Contract.",
    },
    could: {
      status: "UNKNOWN",
      confidence: "UNKNOWN",
      value: null,
      provenance: [],
      reason: "Observed database access does not establish the complete credential permission surface.",
    },
    did: {
      status: "KNOWN",
      confidence: "OBSERVED",
      value: {
        boundary: "db-audit",
        phase: "ACCESSED",
        pageOrigin: null,
        destinationOrigin: `postgres://${input.database}`,
        destinationPath: input.resource,
        method: input.operation.toUpperCase(),
        resourceType: "Database",
        initiatorType: "credential",
        hasPostData: false,
        originRelationship: "UNKNOWN",
        dataCategories: input.dataCategories,
      },
      provenance: [provenance],
      reason: "The database audit sensor observed this credential-backed access after it occurred.",
    },
    why: {
      status: "UNKNOWN",
      confidence: "UNKNOWN",
      value: null,
      provenance: [],
      reason: "No trusted first-party BusinessEvent is correlated to this direct database access.",
    },
    coverage: {
      label: "DB_AUDIT_ONLY",
      boundaries: ["db-audit"],
      limitations: [
        "No gateway traffic is required for this direct database path.",
        "The observation proves database access, not downstream use after the read.",
      ],
    },
  };
}
