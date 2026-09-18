import { describe, expect, it } from "vitest";
import {
  STAGE9_BENCHMARK_ID,
  buildFrozenBenchmarkV1,
  buildSyntheticTrainingSet,
  predictLearningLabel,
  trainStage9Candidate,
} from "./learning-loop.js";

describe("Stage 9 — verified learning loop", () => {
  it("freezes a held-out benchmark separately from synthetic training data", () => {
    const training = buildSyntheticTrainingSet();
    const benchmark = buildFrozenBenchmarkV1();

    expect(STAGE9_BENCHMARK_ID).toBe("stage9-learning-v1-frozen");
    expect(training.length).toBeGreaterThan(100);
    expect(benchmark.length).toBe(96);
    expect(new Set(training.map((row) => row.exampleId)).size).toBe(training.length);
    expect(benchmark.every((row) => row.source === "FROZEN_BENCHMARK")).toBe(true);
    expect(training.every((row) => row.source === "SYNTHETIC_SEED")).toBe(true);
  });

  it("trains an advisory-only candidate that clears the predeclared gate", () => {
    const candidate = trainStage9Candidate([]);

    expect(candidate.promoted).toBe(true);
    expect(candidate.candidateMetrics.accuracy).toBeGreaterThan(candidate.baselineMetrics.accuracy);
    expect(candidate.candidateMetrics.reviewRecall).toBeGreaterThanOrEqual(candidate.baselineMetrics.reviewRecall);
    expect(candidate.candidateMetrics.benignFalseReviewRate).toBeLessThanOrEqual(candidate.baselineMetrics.benignFalseReviewRate);
    expect(candidate.candidateMetrics.authorityViolations).toBe(0);
    expect(candidate.candidateMetrics.harmfulResponseRate).toBe(0);
  });

  it("can only predict REVIEW, OBSERVE, or ABSTAIN", () => {
    const candidate = trainStage9Candidate([]);
    for (const row of buildFrozenBenchmarkV1()) {
      expect(["REVIEW", "OBSERVE", "ABSTAIN"]).toContain(
        predictLearningLabel(candidate.model, row.features),
      );
    }
  });
});
