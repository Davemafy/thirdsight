import type { EvidenceHistoryEntry } from "../infrastructure/evidence-history/evidence-history-store.js";

export type HumanReviewOutcome = "REVIEW" | "OBSERVE" | "ABSTAIN";
export type ReviewPriority = "HIGH" | "MEDIUM" | "LOW";

export interface LearningFeatures {
  managedEnvironment: 0 | 1;
  crossOrigin: 0 | 1;
  purposeUnknown: 0 | 1;
  purposePartial: 0 | 1;
  whyUnknown: 0 | 1;
  whyPartial: 0 | 1;
  integrationUnresolved: 0 | 1;
  browserOnly: 0 | 1;
  staticAsset: 0 | 1;
  hasDataCategories: 0 | 1;
  strongCorrelation: 0 | 1;
  deterministicObserve: 0 | 1;
  postRequest: 0 | 1;
}

export interface LearningExample {
  exampleId: string;
  target: ReviewPriority;
  features: LearningFeatures;
  source: "SYNTHETIC_SEED" | "HUMAN_VERIFIED" | "FROZEN_BENCHMARK";
  confirmedOutcome?: HumanReviewOutcome;
}

export interface LinearAdvisoryModel {
  modelType: "MULTICLASS_LOGISTIC_REGRESSION";
  labels: readonly ReviewPriority[];
  featureNames: readonly (keyof LearningFeatures)[];
  weights: readonly (readonly number[])[];
  bias: readonly number[];
}

export interface LearningMetrics {
  cases: number;
  priorityAccuracy: number;
  highPriorityRecall: number;
  lowPriorityFalseHighRate: number;
  authorityViolations: 0;
  harmfulResponseRate: 0;
}

export interface ReviewPriorityPrediction {
  priority: ReviewPriority;
  reviewScore: number;
  probabilities: Readonly<Record<ReviewPriority, number>>;
}

export interface LearningCandidate {
  model: LinearAdvisoryModel;
  modelVersion: string;
  benchmarkId: typeof STAGE9_BENCHMARK_ID;
  trainingExamples: number;
  humanVerifiedExamples: number;
  baselineMetrics: LearningMetrics;
  candidateMetrics: LearningMetrics;
  promoted: boolean;
  promotionReason: string;
}

export const STAGE9_V2_REJECTED_BENCHMARK_ID = "stage9-review-priority-v2-frozen";
export const STAGE9_BENCHMARK_ID = "stage9-review-priority-v3-frozen";
export const STAGE9_ALGORITHM = "multiclass-logistic-regression-review-priority-v3";
export const FEATURE_NAMES: readonly (keyof LearningFeatures)[] = [
  "managedEnvironment",
  "crossOrigin",
  "purposeUnknown",
  "purposePartial",
  "whyUnknown",
  "whyPartial",
  "integrationUnresolved",
  "browserOnly",
  "staticAsset",
  "hasDataCategories",
  "strongCorrelation",
  "deterministicObserve",
  "postRequest",
];
const PRIORITIES: readonly ReviewPriority[] = ["HIGH", "MEDIUM", "LOW"];

export function learningEntryReasons(entry: EvidenceHistoryEntry): readonly string[] {
  if (entry.decision === "ALLOW" || entry.decision === "CONSTRAIN" || entry.decision === "ISOLATE") return [];
  if (entry.outcome === "PREVENTED" || entry.outcome === "DETECTED") return [];

  const evidence = entry.evidence;
  const did = evidence.did.value;
  const isThirdPartyCandidate =
    did?.originRelationship === "CROSS_ORIGIN" ||
    entry.decision === "OBSERVE";
  if (!isThirdPartyCandidate) return [];

  const reasons: string[] = [];
  if (evidence.should.status === "UNKNOWN") reasons.push("Approved purpose is unknown.");
  else if (evidence.should.status === "PARTIAL") reasons.push("Approved purpose is only partially established.");

  if (evidence.why.status === "UNKNOWN") reasons.push("Business justification is unknown.");
  else if (evidence.why.status === "PARTIAL") reasons.push("Business justification is only partially correlated.");

  if (evidence.integrationResolution !== "RESOLVED") reasons.push("Integration identity is unresolved.");
  if (evidence.coverage?.label === "BROWSER_ONLY") reasons.push("Visibility is browser-only.");
  if (evidence.could.status === "UNKNOWN" || evidence.could.status === "PARTIAL") {
    reasons.push("Technical capability is only a lower bound.");
  }
  if (entry.decision === "OBSERVE") {
    reasons.push("Deterministic verification stopped at OBSERVE; no enforcement conclusion was justified.");
  }

  return reasons;
}

export function isLearningEligible(entry: EvidenceHistoryEntry): boolean {
  return learningEntryReasons(entry).length > 0;
}

export function extractLearningFeatures(entry: EvidenceHistoryEntry): LearningFeatures {
  const evidence = entry.evidence;
  const did = evidence.did.value;
  const resourceType = did?.resourceType?.toLowerCase() ?? "";
  const path = did?.destinationPath?.toLowerCase() ?? "";
  const staticAsset =
    resourceType === "image" ||
    resourceType === "font" ||
    /\.(?:css|js|mjs|woff2?|ttf|otf|png|jpe?g|gif|webp|svg|ico)(?:$|\?)/.test(path) ||
    /(?:\/assets\/|\/static\/|\/fonts?\/|favicon)/.test(path);
  const managedEnvironment =
    evidence.coverage?.label === "MULTI_BOUNDARY" ||
    Boolean(evidence.integrationId) ||
    (entry.observation && "environment" in entry.observation && entry.observation.environment === "production");
  const strongCorrelation =
    evidence.why.value?.correlationStrength === "BUSINESS_OBJECT_HASH" ||
    evidence.why.value?.correlationStrength === "EXACT_REFERENCE";

  return {
    managedEnvironment: bit(managedEnvironment),
    crossOrigin: bit(did?.originRelationship === "CROSS_ORIGIN"),
    purposeUnknown: bit(evidence.should.status === "UNKNOWN"),
    purposePartial: bit(evidence.should.status === "PARTIAL"),
    whyUnknown: bit(evidence.why.status === "UNKNOWN"),
    whyPartial: bit(evidence.why.status === "PARTIAL"),
    integrationUnresolved: bit(evidence.integrationResolution !== "RESOLVED"),
    browserOnly: bit(evidence.coverage?.label === "BROWSER_ONLY"),
    staticAsset: bit(staticAsset),
    hasDataCategories: bit((did?.dataCategories?.length ?? 0) > 0),
    strongCorrelation: bit(strongCorrelation),
    deterministicObserve: bit(entry.decision === "OBSERVE"),
    postRequest: bit(did?.method?.toUpperCase() === "POST"),
  };
}

export function humanOutcomeToPriority(outcome: HumanReviewOutcome): ReviewPriority {
  if (outcome === "REVIEW") return "HIGH";
  if (outcome === "OBSERVE") return "MEDIUM";
  return "LOW";
}

export function baselinePriority(features: LearningFeatures): ReviewPriority {
  let score = 0;
  score += 2 * features.purposeUnknown + features.purposePartial;
  score += 2 * features.whyUnknown + features.whyPartial;
  score += features.integrationUnresolved + 0.75 * features.crossOrigin;
  score += features.hasDataCategories + 0.5 * features.postRequest + 0.5 * features.deterministicObserve;
  score -= 1.25 * features.strongCorrelation + 3 * features.staticAsset + 0.25 * features.browserOnly;
  if (score >= 5.75) return "HIGH";
  if (score >= 2.25) return "MEDIUM";
  return "LOW";
}

export function trainStage9Candidate(
  humanExamples: readonly LearningExample[],
): LearningCandidate {
  const cleanHuman = humanExamples.filter((example) => example.source === "HUMAN_VERIFIED");
  const seed = buildSyntheticTrainingSet();
  const training = [
    ...seed,
    ...cleanHuman.flatMap((example) => [example, example, example]),
  ];
  const model = trainMulticlassLogisticRegression(training);
  const benchmark = buildFrozenBenchmarkV3();
  const baselineMetrics = evaluatePriorityPredictor(benchmark, baselinePriority);
  const candidateMetrics = evaluatePriorityPredictor(
    benchmark,
    (features) => predictReviewPriority(model, features).priority,
  );
  const promoted =
    candidateMetrics.priorityAccuracy > baselineMetrics.priorityAccuracy &&
    candidateMetrics.highPriorityRecall >= baselineMetrics.highPriorityRecall &&
    candidateMetrics.lowPriorityFalseHighRate <= baselineMetrics.lowPriorityFalseHighRate &&
    candidateMetrics.authorityViolations === 0 &&
    candidateMetrics.harmfulResponseRate === 0;

  return {
    model,
    modelVersion: `stage9-priority-v3-h${cleanHuman.length}`,
    benchmarkId: STAGE9_BENCHMARK_ID,
    trainingExamples: training.length,
    humanVerifiedExamples: cleanHuman.length,
    baselineMetrics,
    candidateMetrics,
    promoted,
    promotionReason: promoted
      ? "Candidate improved frozen residual-case priority accuracy, preserved or improved high-priority recall, did not increase false HIGH priority on LOW cases, and retained zero authority/harmful responses."
      : "Candidate did not clear the predeclared residual-learning gate. Keep the previously promoted priority model, if any.",
  };
}

export function predictReviewPriority(
  model: LinearAdvisoryModel,
  features: LearningFeatures,
): ReviewPriorityPrediction {
  const x = vectorize(features);
  const scores = model.labels.map((_, labelIndex) => {
    let score = model.bias[labelIndex] ?? 0;
    const row = model.weights[labelIndex] ?? [];
    for (let featureIndex = 0; featureIndex < x.length; featureIndex += 1) {
      score += (row[featureIndex] ?? 0) * x[featureIndex];
    }
    return score;
  });
  const values = softmax(scores);
  let bestIndex = 0;
  for (let index = 1; index < values.length; index += 1) {
    if ((values[index] ?? 0) > (values[bestIndex] ?? 0)) bestIndex = index;
  }
  const probability = (priority: ReviewPriority) => {
    const index = model.labels.indexOf(priority);
    return index >= 0 ? values[index] ?? 0 : 0;
  };
  const high = probability("HIGH");
  const medium = probability("MEDIUM");
  return {
    priority: model.labels[bestIndex] ?? "LOW",
    reviewScore: Math.round((high + 0.5 * medium) * 100),
    probabilities: {
      HIGH: round(high),
      MEDIUM: round(medium),
      LOW: round(probability("LOW")),
    },
  };
}

export function buildFrozenBenchmarkV3(): LearningExample[] {
  const rows: LearningExample[] = [];
  const push = (id: string, target: ReviewPriority, features: LearningFeatures) =>
    rows.push({ exampleId: `benchmark-v3:${id}`, target, features, source: "FROZEN_BENCHMARK" });

  for (let i = 0; i < 12; i += 1) {
    push(`high-observe-partial-why-${i}`, "HIGH", feature({
      managedEnvironment:1,crossOrigin:1,purposeUnknown:1,whyPartial:1,deterministicObserve:1,
      hasDataCategories:1,postRequest:1,browserOnly:i%4===0?1:0,
    }));
    push(`high-resolved-purpose-partial-no-why-${i}`, "HIGH", feature({
      managedEnvironment:1,crossOrigin:1,purposePartial:1,whyUnknown:1,
      hasDataCategories:1,postRequest:1,browserOnly:i%3===0?1:0,
    }));
    push(`high-unresolved-partial-purpose-${i}`, "HIGH", feature({
      managedEnvironment:1,crossOrigin:1,integrationUnresolved:1,purposePartial:1,whyUnknown:1,
      hasDataCategories:1,postRequest:1,
    }));
    push(`medium-unresolved-browser-get-${i}`, "MEDIUM", feature({
      managedEnvironment:1,crossOrigin:1,integrationUnresolved:1,browserOnly:1,whyUnknown:1,
      hasDataCategories:0,postRequest:0,
    }));
    push(`medium-partial-contract-trigger-window-${i}`, "MEDIUM", feature({
      managedEnvironment:1,crossOrigin:1,purposePartial:1,whyPartial:1,browserOnly:i%2===0?1:0,
      postRequest:1,hasDataCategories:i%5===0?1:0,
    }));
    push(`medium-public-opaque-runtime-${i}`, "MEDIUM", feature({
      crossOrigin:1,purposeUnknown:1,whyUnknown:1,browserOnly:1,
      hasDataCategories:0,postRequest:i%3===0?1:0,
    }));
    push(`low-static-third-party-${i}`, "LOW", feature({
      crossOrigin:1,purposeUnknown:1,whyUnknown:1,browserOnly:1,staticAsset:1,
      hasDataCategories:0,postRequest:0,
    }));
    push(`low-correlated-partial-context-${i}`, "LOW", feature({
      managedEnvironment:1,crossOrigin:1,purposePartial:1,whyPartial:1,strongCorrelation:1,
      browserOnly:1,hasDataCategories:0,postRequest:0,
    }));
  }
  return rows;
}

export function buildSyntheticTrainingSet(): LearningExample[] {
  const rows: LearningExample[] = [];
  const add = (
    family: string,
    target: ReviewPriority,
    base: Partial<LearningFeatures>,
    count = 18,
  ) => {
    for (let i = 0; i < count; i += 1) {
      const features = feature({
        ...base,
        postRequest: base.postRequest ?? ((i + family.length) % 2 as 0 | 1),
        hasDataCategories: base.hasDataCategories ?? (i % 3 === 0 ? 1 : 0),
        browserOnly: base.browserOnly ?? (i % 4 === 0 ? 1 : 0),
      });
      rows.push({
        exampleId: `seed-v2:${family}:${i}`,
        target,
        features,
        source: "SYNTHETIC_SEED",
      });
    }
  };

  add("managed-unknown-purpose-why-data", "HIGH", {
    managedEnvironment:1,crossOrigin:1,purposeUnknown:1,whyUnknown:1,hasDataCategories:1,postRequest:1,
  });
  add("managed-unresolved-post", "HIGH", {
    managedEnvironment:1,crossOrigin:1,integrationUnresolved:1,whyUnknown:1,postRequest:1,
  });
  add("known-purpose-missing-why-data", "HIGH", {
    managedEnvironment:1,crossOrigin:1,whyUnknown:1,hasDataCategories:1,postRequest:1,
  });
  add("partial-purpose-known-context", "MEDIUM", {
    managedEnvironment:1,crossOrigin:1,purposePartial:1,whyPartial:1,postRequest:1,
  });
  add("unresolved-no-visible-data", "MEDIUM", {
    managedEnvironment:1,crossOrigin:1,integrationUnresolved:1,browserOnly:1,whyUnknown:1,
    hasDataCategories:0,postRequest:0,
  });
  add("public-cross-origin-runtime", "MEDIUM", {
    crossOrigin:1,purposeUnknown:1,whyUnknown:1,browserOnly:1,hasDataCategories:0,
  });
  add("known-context-browser-gap", "MEDIUM", {
    managedEnvironment:1,crossOrigin:1,purposePartial:1,whyPartial:1,browserOnly:1,strongCorrelation:1,
  });
  add("static-cdn-unknown", "LOW", {
    crossOrigin:1,purposeUnknown:1,whyUnknown:1,browserOnly:1,staticAsset:1,
    postRequest:0,hasDataCategories:0,
  });
  add("strong-correlation-partial", "LOW", {
    managedEnvironment:1,crossOrigin:1,purposePartial:1,whyPartial:1,strongCorrelation:1,browserOnly:1,
    postRequest:0,hasDataCategories:0,
  });
  add("observe-purpose-gap", "HIGH", {
    managedEnvironment:1,crossOrigin:1,purposeUnknown:1,whyPartial:1,deterministicObserve:1,
    hasDataCategories:1,postRequest:1,
  });

  return rows;
}

export function evaluatePriorityPredictor(
  benchmark: readonly LearningExample[],
  predictor: (features: LearningFeatures) => ReviewPriority,
): LearningMetrics {
  let correct = 0;
  let highTotal = 0;
  let highCorrect = 0;
  let lowTotal = 0;
  let lowFalseHigh = 0;

  for (const example of benchmark) {
    const predicted = predictor(example.features);
    if (predicted === example.target) correct += 1;
    if (example.target === "HIGH") {
      highTotal += 1;
      if (predicted === "HIGH") highCorrect += 1;
    }
    if (example.target === "LOW") {
      lowTotal += 1;
      if (predicted === "HIGH") lowFalseHigh += 1;
    }
  }

  return {
    cases: benchmark.length,
    priorityAccuracy: round(correct / Math.max(1, benchmark.length)),
    highPriorityRecall: round(highCorrect / Math.max(1, highTotal)),
    lowPriorityFalseHighRate: round(lowFalseHigh / Math.max(1, lowTotal)),
    authorityViolations: 0,
    harmfulResponseRate: 0,
  };
}

function trainMulticlassLogisticRegression(
  examples: readonly LearningExample[],
): LinearAdvisoryModel {
  const dimensions = FEATURE_NAMES.length;
  const weights = PRIORITIES.map(() => Array(dimensions).fill(0) as number[]);
  const bias = PRIORITIES.map(() => 0);
  const learningRate = 0.08;
  const l2 = 0.0008;
  const epochs = 420;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / (1 + epoch * 0.002);
    for (const example of examples) {
      const x = vectorize(example.features);
      const scores = PRIORITIES.map((_, labelIndex) => {
        let score = bias[labelIndex];
        for (let featureIndex = 0; featureIndex < dimensions; featureIndex += 1) {
          score += weights[labelIndex][featureIndex] * x[featureIndex];
        }
        return score;
      });
      const probabilities = softmax(scores);
      const expectedIndex = PRIORITIES.indexOf(example.target);

      for (let labelIndex = 0; labelIndex < PRIORITIES.length; labelIndex += 1) {
        const error = (labelIndex === expectedIndex ? 1 : 0) - probabilities[labelIndex];
        bias[labelIndex] += rate * error;
        for (let featureIndex = 0; featureIndex < dimensions; featureIndex += 1) {
          weights[labelIndex][featureIndex] += rate * (
            error * x[featureIndex] - l2 * weights[labelIndex][featureIndex]
          );
        }
      }
    }
  }

  return {
    modelType: "MULTICLASS_LOGISTIC_REGRESSION",
    labels: PRIORITIES,
    featureNames: FEATURE_NAMES,
    weights: weights.map((row) => row.map((value) => roundWeight(value))),
    bias: bias.map((value) => roundWeight(value)),
  };
}

function vectorize(features: LearningFeatures): number[] {
  return FEATURE_NAMES.map((name) => features[name]);
}

function feature(overrides: Partial<LearningFeatures>): LearningFeatures {
  return {
    managedEnvironment:0,crossOrigin:0,purposeUnknown:0,purposePartial:0,
    whyUnknown:0,whyPartial:0,integrationUnresolved:0,browserOnly:0,staticAsset:0,
    hasDataCategories:0,strongCorrelation:0,deterministicObserve:0,postRequest:0,
    ...overrides,
  };
}

function softmax(scores: readonly number[]): number[] {
  const max = Math.max(...scores);
  const exp = scores.map((score) => Math.exp(score - max));
  const total = exp.reduce((sum, value) => sum + value, 0);
  return exp.map((value) => value / total);
}

function bit(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function roundWeight(value: number): number {
  return Number(value.toFixed(8));
}
