import type { EvidenceGraphRecord } from "../domain/evidence.js";
import {
  businessEventEvidence,
  purposeContractEvidence,
  type PurposeContractEvidence,
} from "../domain/evidence-sources.js";
import { enrichEvidenceGraph } from "../domain/evidence-verification.js";
import {
  DETERMINISTIC_DETECTOR_VERSION,
  decideVerification,
  verifyIntegrationLifecycle,
  verifyObservedFields,
  verifyShadowIntegration,
  type VerificationAction,
  type VerificationFinding,
} from "../domain/deterministic-verifier.js";
import { constrainManagedPayload } from "../domain/managed-enforcement.js";

export const UNSEEN_EVALUATION_SEEDS = [73013, 99173, 104729, 161803, 271828] as const;

export interface DetectorEvaluationReport {
  freezeId: "stage7-v1";
  detectorVersion: string;
  seeds: readonly number[];
  totals: {
    cases: number;
    legitimate: number;
    unjustified: number;
    truePositives: number;
    falsePositives: number;
    trueNegatives: number;
    falseNegatives: number;
  };
  metrics: {
    precision: number;
    recall: number;
    falsePositiveRate: number;
    legitimateTrafficDisrupted: number;
    legitimateTrafficDisruptionRate: number;
    preventableUnnecessaryAccess: number;
    unnecessaryAccessPrevented: number;
    unnecessaryAccessPreventionRate: number;
    knownBlindSpotFalseNegatives: number;
  };
  families: Record<string, {
    cases: number;
    violations: number;
    detections: number;
    disruptions: number;
    prevented: number;
  }>;
}

interface EvaluationCase {
  family: string;
  violation: boolean;
  decision: VerificationAction;
  findings: readonly VerificationFinding[];
  prevented: boolean;
  knownBlindSpot: boolean;
}

export function runDetectorEvaluation(
  seeds: readonly number[] = UNSEEN_EVALUATION_SEEDS,
): DetectorEvaluationReport {
  const cases: EvaluationCase[] = [];
  for (const seed of seeds) {
    const rng = mulberry32(seed);
    cases.push(...generateSeedCases(seed, rng));
  }

  let truePositives = 0;
  let falsePositives = 0;
  let trueNegatives = 0;
  let falseNegatives = 0;
  let legitimateTrafficDisrupted = 0;
  let preventableUnnecessaryAccess = 0;
  let unnecessaryAccessPrevented = 0;
  let knownBlindSpotFalseNegatives = 0;
  const families: DetectorEvaluationReport["families"] = {};

  for (const item of cases) {
    const detected = item.findings.length > 0;
    if (item.violation && detected) truePositives += 1;
    else if (!item.violation && detected) falsePositives += 1;
    else if (!item.violation && !detected) trueNegatives += 1;
    else falseNegatives += 1;

    const disruptive = !item.violation && (item.decision === "CONSTRAIN" || item.decision === "ISOLATE");
    if (disruptive) legitimateTrafficDisrupted += 1;
    if (item.violation && item.family.includes("managed-preventable")) preventableUnnecessaryAccess += 1;
    if (item.prevented) unnecessaryAccessPrevented += 1;
    if (item.knownBlindSpot && item.violation && !detected) knownBlindSpotFalseNegatives += 1;

    const family = families[item.family] ?? { cases: 0, violations: 0, detections: 0, disruptions: 0, prevented: 0 };
    family.cases += 1;
    if (item.violation) family.violations += 1;
    if (detected) family.detections += 1;
    if (disruptive) family.disruptions += 1;
    if (item.prevented) family.prevented += 1;
    families[item.family] = family;
  }

  const legitimate = cases.filter((item) => !item.violation).length;
  const unjustified = cases.length - legitimate;

  return {
    freezeId: "stage7-v1",
    detectorVersion: DETERMINISTIC_DETECTOR_VERSION,
    seeds: [...seeds],
    totals: {
      cases: cases.length,
      legitimate,
      unjustified,
      truePositives,
      falsePositives,
      trueNegatives,
      falseNegatives,
    },
    metrics: {
      precision: ratio(truePositives, truePositives + falsePositives),
      recall: ratio(truePositives, truePositives + falseNegatives),
      falsePositiveRate: ratio(falsePositives, falsePositives + trueNegatives),
      legitimateTrafficDisrupted,
      legitimateTrafficDisruptionRate: ratio(legitimateTrafficDisrupted, legitimate),
      preventableUnnecessaryAccess,
      unnecessaryAccessPrevented,
      unnecessaryAccessPreventionRate: ratio(unnecessaryAccessPrevented, preventableUnnecessaryAccess),
      knownBlindSpotFalseNegatives,
    },
    families,
  };
}

function generateSeedCases(seed: number, rng: () => number): EvaluationCase[] {
  const cases: EvaluationCase[] = [];
  const v5 = contractV5();
  const v4 = contractV4();
  const flashCount = randInt(rng, 35, 55);
  const proportionalCount = randInt(rng, 6, 12);
  const staleCount = randInt(rng, 2, 5);
  const shadowCount = randInt(rng, 2, 5);
  const contractPairs = randInt(rng, 3, 6);
  const fieldDriftCount = randInt(rng, 3, 7);
  const perfectMimicCount = randInt(rng, 2, 4);

  for (let index = 0; index < flashCount; index += 1) {
    cases.push(browserCase({
      family: "flash-sale-legitimate",
      seed,
      index,
      contract: v5,
      eventRef: `flash-${seed}-${index}`,
      observedRef: `flash-${seed}-${index}`,
      observedFields: ["product.id", "product.category", "product.price"],
      violation: false,
    }));
  }

  for (let index = 0; index < proportionalCount; index += 1) {
    cases.push(browserCase({
      family: "proportional-exfiltration",
      seed,
      index,
      contract: v5,
      eventRef: `sale-object-${seed}-${index}`,
      observedRef: `unrelated-object-${seed}-${index}`,
      observedFields: ["product.id", "product.category", "product.price"],
      violation: true,
    }));
  }

  for (let index = 0; index < fieldDriftCount; index += 1) {
    cases.push(browserCase({
      family: "managed-preventable-field-drift",
      seed,
      index,
      contract: v5,
      eventRef: `field-drift-${seed}-${index}`,
      observedRef: `field-drift-${seed}-${index}`,
      observedFields: ["product.id", "product.category", "product.price", "customer.phone"],
      violation: true,
      enforcePayload: {
        "product.id": `sku-${seed}-${index}`,
        "product.category": "phones",
        "product.price": 100000 + index,
        "customer.phone": "synthetic",
      },
    }));
  }

  for (let index = 0; index < staleCount; index += 1) {
    const evidence = dbAuditEvidence(seed, index);
    const findings = verifyIntegrationLifecycle(evidence, {
      integrationId: "legacy-crm",
      displayName: "Legacy CRM",
      lifecycleStatus: "RETIRED",
      owner: "Commerce Ops",
      credentialId: `legacy-${seed}-${index}`,
    });
    cases.push({
      family: "stale-crm-direct-db",
      violation: true,
      decision: decideVerification(findings),
      findings,
      prevented: false,
      knownBlindSpot: false,
    });
  }

  for (let index = 0; index < shadowCount; index += 1) {
    const evidence = shadowEvidence(seed, index);
    const findings = verifyShadowIntegration(evidence, {
      managedEnvironment: true,
      integrationInventoryComplete: true,
    });
    cases.push({
      family: "opaque-shadow-integration",
      violation: true,
      decision: decideVerification(findings),
      findings,
      prevented: false,
      knownBlindSpot: false,
    });
  }

  for (let index = 0; index < contractPairs; index += 1) {
    cases.push(contractVersionCase(seed, index, v4, true));
    cases.push(contractVersionCase(seed, index, v5, false));
  }

  for (let index = 0; index < perfectMimicCount; index += 1) {
    cases.push(browserCase({
      family: "perfect-mimic-known-blind-spot",
      seed,
      index,
      contract: v5,
      eventRef: `mimic-${seed}-${index}`,
      observedRef: `mimic-${seed}-${index}`,
      observedFields: ["product.id", "product.category", "product.price"],
      violation: true,
      knownBlindSpot: true,
    }));
  }

  return shuffle(cases, rng);
}

function browserCase(input: {
  family: string;
  seed: number;
  index: number;
  contract: PurposeContractEvidence;
  eventRef: string;
  observedRef: string;
  observedFields: readonly string[];
  violation: boolean;
  enforcePayload?: Record<string, unknown>;
  knownBlindSpot?: boolean;
}): EvaluationCase {
  const observedAt = new Date(Date.parse("2026-09-18T12:00:00.000Z") + input.index * 1000).toISOString();
  const event = businessEventEvidence({
    id: `eval:${input.family}:${input.seed}:${input.index}`,
    type: "product.viewed",
    timestamp: observedAt,
    orderRefHash: input.eventRef,
    integrationId: "analytics-partner",
  });
  const evidence = enrichEvidenceGraph(
    baseBrowserEvidence(input.seed, input.index, observedAt, input.observedRef),
    {
      purposeContracts: [input.contract],
      businessEvents: [event],
      capabilities: [],
    },
  );
  const withFields = evidence.did.value
    ? { ...evidence, did: { ...evidence.did, value: { ...evidence.did.value, dataCategories: input.observedFields } } }
    : evidence;
  const findings = verifyObservedFields(withFields, input.observedFields, [input.contract]);
  const decision = decideVerification(findings);
  const prevention = input.enforcePayload
    ? constrainManagedPayload(input.enforcePayload, findings)
    : null;
  return {
    family: input.family,
    violation: input.violation,
    decision,
    findings,
    prevented: prevention?.outcome === "PREVENTED",
    knownBlindSpot: input.knownBlindSpot ?? false,
  };
}

function contractVersionCase(
  seed: number,
  index: number,
  contract: PurposeContractEvidence,
  beforeChange: boolean,
): EvaluationCase {
  const observedAt = beforeChange
    ? new Date(Date.parse("2026-09-18T10:59:30.000Z") - index * 1000).toISOString()
    : new Date(Date.parse("2026-09-18T11:00:30.000Z") + index * 1000).toISOString();
  const ref = `contract-${seed}-${index}-${beforeChange ? "pre" : "post"}`;
  const event = businessEventEvidence({
    id: `eval:contract:${seed}:${index}:${beforeChange ? "pre" : "post"}`,
    type: "product.viewed",
    timestamp: observedAt,
    orderRefHash: ref,
    integrationId: "analytics-partner",
  });
  const evidence = enrichEvidenceGraph(
    baseBrowserEvidence(seed, index, observedAt, ref),
    {
      purposeContracts: [contractV4(), contractV5()],
      businessEvents: [event],
      capabilities: [],
    },
  );
  const observedFields = ["product.id", "product.category", "product.price", "customer.loyalty_tier"] as const;
  const withFields = evidence.did.value
    ? { ...evidence, did: { ...evidence.did, value: { ...evidence.did.value, dataCategories: observedFields } } }
    : evidence;
  const findings = verifyObservedFields(withFields, observedFields, [contract]);
  const decision = decideVerification(findings);
  const prevention = beforeChange
    ? constrainManagedPayload({
        "product.id": "sku",
        "product.category": "phones",
        "product.price": 120000,
        "customer.loyalty_tier": "gold",
      }, findings)
    : null;

  return {
    family: beforeChange ? "managed-preventable-contract-pre-change" : "contract-post-change-legitimate",
    violation: beforeChange,
    decision,
    findings,
    prevented: prevention?.outcome === "PREVENTED",
    knownBlindSpot: false,
  };
}

function baseBrowserEvidence(seed: number, index: number, observedAt: string, orderRefHash: string): EvidenceGraphRecord {
  return {
    recordId: `eval:browser:${seed}:${index}:${orderRefHash}`,
    observedAt,
    integrationId: "analytics-partner",
    integrationResolution: "RESOLVED",
    should: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
    could: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
    did: {
      status: "KNOWN",
      confidence: "OBSERVED",
      value: {
        boundary: "browser",
        phase: "ATTEMPTED",
        pageOrigin: "https://commerce-lab.example",
        destinationOrigin: "https://analytics.example",
        destinationPath: "/collect",
        method: "POST",
        resourceType: "Fetch",
        initiatorType: "script",
        hasPostData: true,
        originRelationship: "CROSS_ORIGIN",
        businessObjectRefs: { orderRefHash },
      },
      provenance: [{ source: "browser", sourceId: `eval:${seed}:${index}`, observedAt, confidence: "OBSERVED" }],
    },
    why: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
  };
}

function dbAuditEvidence(seed: number, index: number): EvidenceGraphRecord {
  const observedAt = new Date(Date.parse("2026-09-18T12:30:00.000Z") + index * 1000).toISOString();
  return {
    recordId: `eval:db:${seed}:${index}`,
    observedAt,
    integrationId: "legacy-crm",
    integrationResolution: "RESOLVED",
    should: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
    could: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
    did: {
      status: "KNOWN",
      confidence: "OBSERVED",
      value: {
        boundary: "db-audit",
        phase: "ACCESSED",
        pageOrigin: null,
        destinationOrigin: "postgres://commerce-lab",
        destinationPath: "public.customers",
        method: "SELECT",
        resourceType: "Database",
        initiatorType: "credential",
        hasPostData: false,
        originRelationship: "UNKNOWN",
        dataCategories: ["customer.email", "customer.phone"],
      },
      provenance: [{ source: "db-audit", sourceId: `eval:db:${seed}:${index}`, observedAt, confidence: "OBSERVED" }],
    },
    why: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
  };
}

function shadowEvidence(seed: number, index: number): EvidenceGraphRecord {
  const observedAt = new Date(Date.parse("2026-09-18T12:45:00.000Z") + index * 1000).toISOString();
  return {
    recordId: `eval:shadow:${seed}:${index}`,
    observedAt,
    integrationId: null,
    integrationResolution: "UNRESOLVED",
    should: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
    could: {
      status: "PARTIAL",
      confidence: "OBSERVED_LOWER_BOUND",
      value: {
        kind: "BROWSER_REQUEST_EXECUTION",
        destinationOrigin: "https://shadowpixel.invalid",
        statement: "Observed browser execution is a lower bound only.",
      },
      provenance: [{ source: "browser", sourceId: `eval:shadow:${seed}:${index}`, observedAt, confidence: "OBSERVED_LOWER_BOUND" }],
    },
    did: {
      status: "KNOWN",
      confidence: "OBSERVED",
      value: {
        boundary: "browser",
        phase: "ATTEMPTED",
        pageOrigin: "https://commerce-lab.example",
        destinationOrigin: "https://shadowpixel.invalid",
        destinationPath: "/pixel",
        method: "POST",
        resourceType: "Fetch",
        initiatorType: "script",
        hasPostData: true,
        originRelationship: "CROSS_ORIGIN",
      },
      provenance: [{ source: "browser", sourceId: `eval:shadow:${seed}:${index}`, observedAt, confidence: "OBSERVED" }],
    },
    why: { status: "UNKNOWN", confidence: "UNKNOWN", value: null, provenance: [] },
  };
}

function contractV4(): PurposeContractEvidence {
  return purposeContractEvidence({
    contractId: "analytics-product-view",
    integrationId: "analytics-partner",
    version: "4",
    purpose: "Measure product interest",
    resources: ["analytics.events"],
    fields: ["product.id", "product.category", "product.price"],
    operations: ["send"],
    validTriggers: ["product.viewed"],
    environment: "production",
    validFrom: "2026-09-18T10:00:00.000Z",
    reviewAt: "2026-09-18T11:00:00.000Z",
    expiresAt: "2026-09-18T11:00:00.000Z",
    owner: "commerce",
    approvedBy: "privacy",
    changeReason: "Pre-loyalty scope",
  }, "eval:contract:v4");
}

function contractV5(): PurposeContractEvidence {
  return purposeContractEvidence({
    contractId: "analytics-product-view",
    integrationId: "analytics-partner",
    version: "5",
    purpose: "Measure product interest with loyalty segmentation",
    resources: ["analytics.events"],
    fields: ["product.id", "product.category", "product.price", "customer.loyalty_tier"],
    operations: ["send"],
    validTriggers: ["product.viewed"],
    environment: "production",
    validFrom: "2026-09-18T11:00:00.000Z",
    reviewAt: "2026-10-18T11:00:00.000Z",
    expiresAt: null,
    owner: "commerce",
    approvedBy: "privacy",
    changeReason: "Approved loyalty field",
  }, "eval:contract:v5");
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(6));
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function shuffle<T>(values: readonly T[], rng: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
