import type {
  BrowserCapabilityLowerBound,
  BusinessContextEvidence,
  EvidenceGraphRecord,
  EvidenceStatus,
  PurposeEvidence,
  RuntimeAccessEvidence,
} from "../domain/evidence.js";
import type {
  VerificationAction,
  VerificationFinding,
} from "../domain/deterministic-verifier.js";

export type AiAssessmentLabel =
  | "NEEDS_REVIEW"
  | "INSUFFICIENT_EVIDENCE"
  | "EXPLAINABLE_OBSERVATION";

export type AiConfidence = "LOW" | "MEDIUM" | "HIGH";
export type AiRecommendedResponse = "OBSERVE" | "REVIEW" | "ABSTAIN";

export interface AiAnalystAssessment {
  assessment: AiAssessmentLabel;
  evidence_used: readonly string[];
  unsupported_assumptions: readonly string[];
  confidence: AiConfidence;
  recommended_response: AiRecommendedResponse;
  explanation: string;
}

export interface AiAnalystInput {
  recordId: string;
  deterministicDecision: VerificationAction;
  should: SanitizedClaim<PurposeEvidence>;
  could: SanitizedClaim<BrowserCapabilityLowerBound>;
  did: {
    status: EvidenceStatus;
    confidence: string;
    boundary: RuntimeAccessEvidence["boundary"] | null;
    phase: RuntimeAccessEvidence["phase"] | null;
    destinationOrigin: string | null;
    destinationPath: string | null;
    method: string | null;
    resourceType: string | null;
    originRelationship: RuntimeAccessEvidence["originRelationship"] | null;
    dataCategories: readonly string[];
    hasBusinessObjectReference: boolean;
    reason: string | null;
    provenanceSources: readonly string[];
  };
  why: {
    status: EvidenceStatus;
    confidence: string;
    eventType: string | null;
    correlationStrength: BusinessContextEvidence["correlationStrength"] | null;
    reason: string | null;
    provenanceSources: readonly string[];
  };
  coverage: {
    label: string;
    boundaries: readonly string[];
    limitations: readonly string[];
  } | null;
  findings: readonly {
    type: string;
    action: string;
    reason: string;
  }[];
  allowedEvidenceRefs: readonly string[];
}

interface SanitizedClaim<T> {
  status: EvidenceStatus;
  confidence: string;
  value: T | null;
  reason: string | null;
  provenanceSources: readonly string[];
}

export function isAiEligibleAmbiguity(
  evidence: EvidenceGraphRecord,
  decision: VerificationAction,
): boolean {
  if (decision === "CONSTRAIN" || decision === "ISOLATE") return false;
  if (decision === "OBSERVE") return true;
  return [evidence.should.status, evidence.could.status, evidence.did.status, evidence.why.status]
    .some((status) => status === "UNKNOWN" || status === "PARTIAL");
}

export function buildAiAnalystInput(
  evidence: EvidenceGraphRecord,
  decision: VerificationAction,
  findings: readonly VerificationFinding[],
): AiAnalystInput {
  const refs = new Set<string>();
  const add = (value: string) => refs.add(value);

  add("deterministic.decision");
  add("should.status");
  add("should.confidence");
  if (evidence.should.reason) add("should.reason");
  if (evidence.should.value) {
    add("should.contract");
    add("should.purpose");
    add("should.fields");
    add("should.operations");
    add("should.valid_triggers");
  }

  add("could.status");
  add("could.confidence");
  if (evidence.could.reason) add("could.reason");
  if (evidence.could.value) {
    add("could.kind");
    add("could.destination_origin");
    add("could.statement");
  }

  add("did.status");
  add("did.confidence");
  if (evidence.did.reason) add("did.reason");
  if (evidence.did.value) {
    add("did.boundary");
    add("did.phase");
    add("did.destination_origin");
    add("did.destination_path");
    add("did.method");
    add("did.resource_type");
    add("did.origin_relationship");
    add("did.data_categories");
    add("did.has_business_object_reference");
  }

  add("why.status");
  add("why.confidence");
  if (evidence.why.reason) add("why.reason");
  if (evidence.why.value) {
    add("why.event_type");
    add("why.correlation_strength");
  }

  if (evidence.coverage) {
    add("coverage.label");
    add("coverage.boundaries");
    add("coverage.limitations");
  }

  for (const finding of findings) add(`finding.${finding.type}`);

  return {
    recordId: evidence.recordId,
    deterministicDecision: decision,
    should: {
      status: evidence.should.status,
      confidence: evidence.should.confidence,
      value: evidence.should.value
        ? {
            contractId: evidence.should.value.contractId,
            contractVersion: evidence.should.value.contractVersion,
            purpose: evidence.should.value.purpose,
            resources: evidence.should.value.resources,
            fields: evidence.should.value.fields,
            operations: evidence.should.value.operations,
            validTriggers: evidence.should.value.validTriggers,
          }
        : null,
      reason: evidence.should.reason ?? null,
      provenanceSources: uniqueSources(evidence.should.provenance),
    },
    could: {
      status: evidence.could.status,
      confidence: evidence.could.confidence,
      value: evidence.could.value
        ? {
            kind: evidence.could.value.kind,
            destinationOrigin: evidence.could.value.destinationOrigin,
            statement: evidence.could.value.statement,
          }
        : null,
      reason: evidence.could.reason ?? null,
      provenanceSources: uniqueSources(evidence.could.provenance),
    },
    did: {
      status: evidence.did.status,
      confidence: evidence.did.confidence,
      boundary: evidence.did.value?.boundary ?? null,
      phase: evidence.did.value?.phase ?? null,
      destinationOrigin: evidence.did.value?.destinationOrigin ?? null,
      destinationPath: evidence.did.value?.destinationPath ?? null,
      method: evidence.did.value?.method ?? null,
      resourceType: evidence.did.value?.resourceType ?? null,
      originRelationship: evidence.did.value?.originRelationship ?? null,
      dataCategories: evidence.did.value?.dataCategories ?? [],
      hasBusinessObjectReference: Boolean(
        evidence.did.value?.businessObjectRefs &&
          Object.values(evidence.did.value.businessObjectRefs).some(Boolean),
      ),
      reason: evidence.did.reason ?? null,
      provenanceSources: uniqueSources(evidence.did.provenance),
    },
    why: {
      status: evidence.why.status,
      confidence: evidence.why.confidence,
      eventType: evidence.why.value?.eventType ?? null,
      correlationStrength: evidence.why.value?.correlationStrength ?? null,
      reason: evidence.why.reason ?? null,
      provenanceSources: uniqueSources(evidence.why.provenance),
    },
    coverage: evidence.coverage
      ? {
          label: evidence.coverage.label,
          boundaries: evidence.coverage.boundaries,
          limitations: evidence.coverage.limitations,
        }
      : null,
    findings: findings.map((finding) => ({
      type: finding.type,
      action: finding.action,
      reason: finding.reason,
    })),
    allowedEvidenceRefs: [...refs].sort(),
  };
}

export function enforceAiAuthority(
  assessment: AiAnalystAssessment,
  allowedEvidenceRefs: ReadonlySet<string>,
): AiAnalystAssessment {
  if (!["NEEDS_REVIEW", "INSUFFICIENT_EVIDENCE", "EXPLAINABLE_OBSERVATION"].includes(assessment.assessment)) {
    throw new Error("AI assessment label is outside the advisory contract.");
  }
  if (!["LOW", "MEDIUM", "HIGH"].includes(assessment.confidence)) {
    throw new Error("AI confidence is outside the advisory contract.");
  }
  if (!["OBSERVE", "REVIEW", "ABSTAIN"].includes(assessment.recommended_response)) {
    throw new Error("AI attempted a response outside OBSERVE / REVIEW / ABSTAIN.");
  }
  if (!Array.isArray(assessment.evidence_used) || assessment.evidence_used.some((ref) => !allowedEvidenceRefs.has(ref))) {
    throw new Error("AI cited evidence that was not present in its structured input.");
  }
  if (!Array.isArray(assessment.unsupported_assumptions)) {
    throw new Error("AI must explicitly return unsupported_assumptions.");
  }
  if (typeof assessment.explanation !== "string" || assessment.explanation.trim().length === 0) {
    throw new Error("AI explanation is required.");
  }
  return {
    ...assessment,
    evidence_used: [...new Set(assessment.evidence_used)],
    unsupported_assumptions: [...new Set(assessment.unsupported_assumptions)],
    explanation: assessment.explanation.trim(),
  };
}

function uniqueSources(provenance: readonly { source: string }[]): string[] {
  return [...new Set(provenance.map((item) => item.source))].sort();
}
