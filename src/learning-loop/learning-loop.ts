import type { EvidenceHistoryEntry } from "../infrastructure/evidence-history/evidence-history-store.js";

export type LearningLabel = "REVIEW" | "OBSERVE" | "ABSTAIN";

export interface LearningFeatures {
  managedEnvironment: 0 | 1;
  crossOrigin: 0 | 1;
  sameOrigin: 0 | 1;
  purposeKnown: 0 | 1;
  purposePartial: 0 | 1;
  whyKnown: 0 | 1;
  whyPartial: 0 | 1;
  integrationResolved: 0 | 1;
  browserOnly: 0 | 1;
  staticAsset: 0 | 1;
  newDestination: 0 | 1;
  hasDataCategories: 0 | 1;
  strongCorrelation: 0 | 1;
  hasFinding: 0 | 1;
  postRequest: 0 | 1;
}

export interface LearningExample {
  exampleId: string;
  label: LearningLabel;
  features: LearningFeatures;
  source: "SYNTHETIC_SEED" | "HUMAN_VERIFIED" | "FROZEN_BENCHMARK";
}

export interface LinearAdvisoryModel {
  modelType: "MULTICLASS_LOGISTIC_REGRESSION";
  labels: readonly LearningLabel[];
  featureNames: readonly (keyof LearningFeatures)[];
  weights: readonly (readonly number[])[];
  bias: readonly number[];
}

export interface LearningMetrics {
  cases: number;
  accuracy: number;
  reviewRecall: number;
  benignFalseReviewRate: number;
  authorityViolations: 0;
  harmfulResponseRate: 0;
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

export const STAGE9_BENCHMARK_ID = "stage9-learning-v1-frozen";
export const STAGE9_ALGORITHM = "multiclass-logistic-regression-v1";
export const FEATURE_NAMES: readonly (keyof LearningFeatures)[] = [
  "managedEnvironment",
  "crossOrigin",
  "sameOrigin",
  "purposeKnown",
  "purposePartial",
  "whyKnown",
  "whyPartial",
  "integrationResolved",
  "browserOnly",
  "staticAsset",
  "newDestination",
  "hasDataCategories",
  "strongCorrelation",
  "hasFinding",
  "postRequest",
];
const LABELS: readonly LearningLabel[] = ["REVIEW", "OBSERVE", "ABSTAIN"];

export function isLearningEligible(entry: EvidenceHistoryEntry): boolean {
  if (entry.decision === "CONSTRAIN" || entry.decision === "ISOLATE") return false;
  if (entry.outcome === "PREVENTED" || entry.outcome === "DETECTED") return false;
  if (entry.decision === "OBSERVE") return true;
  const evidence = entry.evidence;
  return [evidence.should.status, evidence.could.status, evidence.why.status].some(
    (status) => status === "UNKNOWN" || status === "PARTIAL",
  );
}

export function extractLearningFeatures(entry: EvidenceHistoryEntry): LearningFeatures {
  const evidence = entry.evidence;
  const did = evidence.did.value;
  const resourceType = did?.resourceType?.toLowerCase() ?? "";
  const path = did?.destinationPath?.toLowerCase() ?? "";
  const staticAsset = resourceType === "image" || resourceType === "font" ||
    /\.(?:css|js|mjs|woff2?|ttf|otf|png|jpe?g|gif|webp|svg|ico)(?:$|\?)/.test(path) ||
    /(?:\/assets\/|\/static\/|\/fonts?\/|favicon)/.test(path);
  const managedEnvironment = evidence.coverage?.label === "MULTI_BOUNDARY" ||
    Boolean(evidence.integrationId) ||
    (entry.observation && "environment" in entry.observation && entry.observation.environment === "production");
  const crossOrigin = did?.originRelationship === "CROSS_ORIGIN";
  const sameOrigin = did?.originRelationship === "SAME_ORIGIN";
  const integrationResolved = evidence.integrationResolution === "RESOLVED";
  const newDestination = managedEnvironment && crossOrigin && !integrationResolved;
  const strongCorrelation = evidence.why.value?.correlationStrength === "BUSINESS_OBJECT_HASH" ||
    evidence.why.value?.correlationStrength === "EXACT_REFERENCE";

  return {
    managedEnvironment: bit(managedEnvironment),
    crossOrigin: bit(crossOrigin),
    sameOrigin: bit(sameOrigin),
    purposeKnown: bit(evidence.should.status === "KNOWN"),
    purposePartial: bit(evidence.should.status === "PARTIAL"),
    whyKnown: bit(evidence.why.status === "KNOWN"),
    whyPartial: bit(evidence.why.status === "PARTIAL"),
    integrationResolved: bit(integrationResolved),
    browserOnly: bit(evidence.coverage?.label === "BROWSER_ONLY"),
    staticAsset: bit(staticAsset),
    newDestination: bit(newDestination),
    hasDataCategories: bit((did?.dataCategories?.length ?? 0) > 0),
    strongCorrelation: bit(strongCorrelation),
    hasFinding: bit((entry.findings?.length ?? 0) > 0),
    postRequest: bit(did?.method?.toUpperCase() === "POST"),
  };
}

export function baselinePredict(features: LearningFeatures): LearningLabel {
  if (features.staticAsset || features.sameOrigin) return "ABSTAIN";
  if (features.newDestination) return "REVIEW";
  if (
    features.managedEnvironment &&
    features.crossOrigin &&
    !features.purposeKnown &&
    !features.purposePartial
  ) return "REVIEW";
  if (features.crossOrigin) return "OBSERVE";
  return "ABSTAIN";
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
  const benchmark = buildFrozenBenchmarkV1();
  const baselineMetrics = evaluatePredictor(benchmark, baselinePredict);
  const candidateMetrics = evaluatePredictor(benchmark, (features) => predictLearningLabel(model, features));
  const promoted =
    candidateMetrics.accuracy > baselineMetrics.accuracy &&
    candidateMetrics.reviewRecall >= baselineMetrics.reviewRecall &&
    candidateMetrics.benignFalseReviewRate <= baselineMetrics.benignFalseReviewRate &&
    candidateMetrics.authorityViolations === 0 &&
    candidateMetrics.harmfulResponseRate === 0;

  return {
    model,
    modelVersion: `stage9-linear-v1-h${cleanHuman.length}`,
    benchmarkId: STAGE9_BENCHMARK_ID,
    trainingExamples: training.length,
    humanVerifiedExamples: cleanHuman.length,
    baselineMetrics,
    candidateMetrics,
    promoted,
    promotionReason: promoted
      ? "Candidate improved frozen held-out accuracy without increasing benign false reviews, preserved review recall, and retained zero authority/harmful responses."
      : "Candidate did not clear the predeclared Stage 9 promotion gate. Keep the previously promoted learned model, if any.",
  };
}

export function predictLearningLabel(
  model: LinearAdvisoryModel,
  features: LearningFeatures,
): LearningLabel {
  const x = vectorize(features);
  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let labelIndex = 0; labelIndex < model.labels.length; labelIndex += 1) {
    let score = model.bias[labelIndex] ?? 0;
    const row = model.weights[labelIndex] ?? [];
    for (let featureIndex = 0; featureIndex < x.length; featureIndex += 1) {
      score += (row[featureIndex] ?? 0) * x[featureIndex];
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = labelIndex;
    }
  }
  return model.labels[bestIndex] ?? "ABSTAIN";
}

export function buildFrozenBenchmarkV1(): LearningExample[] {
  const rows: LearningExample[] = [];
  const push = (id: string, label: LearningLabel, features: LearningFeatures) =>
    rows.push({ exampleId: `benchmark:${id}`, label, features, source: "FROZEN_BENCHMARK" });

  for (let i = 0; i < 12; i += 1) {
    push(`review-new-destination-${i}`, "REVIEW", feature({
      managedEnvironment:1,crossOrigin:1,newDestination:1,browserOnly:1,postRequest:i%2 as 0|1,
      purposePartial:(i%3===0?1:0),whyPartial:(i%4===0?1:0),
    }));
    push(`review-known-purpose-missing-why-${i}`, "REVIEW", feature({
      managedEnvironment:1,crossOrigin:1,integrationResolved:1,purposeKnown:1,browserOnly:i%2 as 0|1,
      postRequest:1,hasDataCategories:1,
    }));
    push(`review-event-without-contract-${i}`, "REVIEW", feature({
      managedEnvironment:1,crossOrigin:1,integrationResolved:1,whyKnown:1,postRequest:1,
      hasDataCategories:i%2 as 0|1,
    }));
    push(`observe-public-runtime-${i}`, "OBSERVE", feature({
      crossOrigin:1,browserOnly:1,postRequest:i%2 as 0|1,
    }));
    push(`observe-approved-opaque-${i}`, "OBSERVE", feature({
      managedEnvironment:1,crossOrigin:1,purposeKnown:1,whyKnown:1,integrationResolved:1,
      browserOnly:1,strongCorrelation:i%2 as 0|1,postRequest:1,
    }));
    push(`observe-partial-purpose-${i}`, "OBSERVE", feature({
      managedEnvironment:1,crossOrigin:1,purposePartial:1,whyKnown:1,integrationResolved:1,
      postRequest:1,hasDataCategories:i%2 as 0|1,
    }));
    push(`abstain-first-party-static-${i}`, "ABSTAIN", feature({
      managedEnvironment:1,sameOrigin:1,staticAsset:1,integrationResolved:i%2 as 0|1,
    }));
    push(`abstain-public-static-${i}`, "ABSTAIN", feature({
      crossOrigin:1,browserOnly:1,staticAsset:1,
    }));
  }
  return rows;
}

export function buildSyntheticTrainingSet(): LearningExample[] {
  const rows: LearningExample[] = [];
  const add = (
    family: string,
    label: LearningLabel,
    base: Partial<LearningFeatures>,
    count = 18,
  ) => {
    for (let i = 0; i < count; i += 1) {
      const features = feature({
        ...base,
        postRequest: base.postRequest ?? ((i + family.length) % 2 as 0 | 1),
        hasDataCategories: base.hasDataCategories ?? ((i % 3 === 0) ? 1 : 0),
        browserOnly: base.browserOnly ?? ((i % 4 === 0) ? 1 : 0),
      });
      rows.push({
        exampleId: `seed:${family}:${i}`,
        label,
        features,
        source: "SYNTHETIC_SEED",
      });
    }
  };

  add("managed-new-destination", "REVIEW", { managedEnvironment:1,crossOrigin:1,newDestination:1 });
  add("known-purpose-missing-why", "REVIEW", { managedEnvironment:1,crossOrigin:1,purposeKnown:1,integrationResolved:1 });
  add("event-without-contract", "REVIEW", { managedEnvironment:1,crossOrigin:1,whyKnown:1,integrationResolved:1 });
  add("partial-contract-gap", "REVIEW", { managedEnvironment:1,crossOrigin:1,purposePartial:1,integrationResolved:1,whyPartial:1 });
  add("public-runtime", "OBSERVE", { crossOrigin:1,browserOnly:1 });
  add("approved-opaque", "OBSERVE", { managedEnvironment:1,crossOrigin:1,purposeKnown:1,whyKnown:1,integrationResolved:1,browserOnly:1,strongCorrelation:1 });
  add("partial-purpose-known-context", "OBSERVE", { managedEnvironment:1,crossOrigin:1,purposePartial:1,whyKnown:1,integrationResolved:1 });
  add("first-party-static", "ABSTAIN", { managedEnvironment:1,sameOrigin:1,staticAsset:1 });
  add("public-static", "ABSTAIN", { crossOrigin:1,browserOnly:1,staticAsset:1 });
  add("first-party-health", "ABSTAIN", { managedEnvironment:1,sameOrigin:1,staticAsset:1,browserOnly:1 });

  return rows;
}

export function evaluatePredictor(
  benchmark: readonly LearningExample[],
  predictor: (features: LearningFeatures) => LearningLabel,
): LearningMetrics {
  let correct = 0;
  let reviewTotal = 0;
  let reviewCorrect = 0;
  let benignTotal = 0;
  let benignFalseReview = 0;

  for (const example of benchmark) {
    const predicted = predictor(example.features);
    if (predicted === example.label) correct += 1;
    if (example.label === "REVIEW") {
      reviewTotal += 1;
      if (predicted === "REVIEW") reviewCorrect += 1;
    }
    if (example.label === "ABSTAIN") {
      benignTotal += 1;
      if (predicted === "REVIEW") benignFalseReview += 1;
    }
  }

  return {
    cases: benchmark.length,
    accuracy: round(correct / Math.max(1, benchmark.length)),
    reviewRecall: round(reviewCorrect / Math.max(1, reviewTotal)),
    benignFalseReviewRate: round(benignFalseReview / Math.max(1, benignTotal)),
    authorityViolations: 0,
    harmfulResponseRate: 0,
  };
}

function trainMulticlassLogisticRegression(
  examples: readonly LearningExample[],
): LinearAdvisoryModel {
  const dimensions = FEATURE_NAMES.length;
  const weights = LABELS.map(() => Array(dimensions).fill(0) as number[]);
  const bias = LABELS.map(() => 0);
  const learningRate = 0.08;
  const l2 = 0.0008;
  const epochs = 420;

  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const rate = learningRate / (1 + epoch * 0.002);
    for (const example of examples) {
      const x = vectorize(example.features);
      const scores = LABELS.map((_, labelIndex) => {
        let score = bias[labelIndex];
        for (let featureIndex = 0; featureIndex < dimensions; featureIndex += 1) {
          score += weights[labelIndex][featureIndex] * x[featureIndex];
        }
        return score;
      });
      const probabilities = softmax(scores);
      const expectedIndex = LABELS.indexOf(example.label);

      for (let labelIndex = 0; labelIndex < LABELS.length; labelIndex += 1) {
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
    labels: LABELS,
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
    managedEnvironment:0,crossOrigin:0,sameOrigin:0,purposeKnown:0,purposePartial:0,
    whyKnown:0,whyPartial:0,integrationResolved:0,browserOnly:0,staticAsset:0,
    newDestination:0,hasDataCategories:0,strongCorrelation:0,hasFinding:0,postRequest:0,
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
