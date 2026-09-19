import { describe, expect, it } from "vitest";
import {
  STAGE9_BENCHMARK_ID,
  buildFrozenBenchmarkV3,
  buildSyntheticTrainingSet,
  humanOutcomeToPriority,
  isLearningEligible,
  learningEntryReasons,
  predictReviewPriority,
  trainStage9Candidate,
} from "./learning-loop.js";

describe("Stage 9 — verified residual learning", () => {
  it("freezes a residual-only held-out benchmark separately from synthetic training data", () => {
    const training = buildSyntheticTrainingSet();
    const benchmark = buildFrozenBenchmarkV3();

    expect(STAGE9_BENCHMARK_ID).toBe("stage9-review-priority-v3-frozen");
    expect(training).toHaveLength(180);
    expect(benchmark).toHaveLength(96);
    expect(new Set(training.map((row) => row.exampleId)).size).toBe(training.length);
    expect(benchmark.every((row) => row.source === "FROZEN_BENCHMARK")).toBe(true);
    expect(training.every((row) => row.source === "SYNTHETIC_SEED")).toBe(true);
    expect([...training, ...benchmark].every((row) => row.features.crossOrigin === 1)).toBe(true);
  });

  it("learns review priority rather than deterministic enforcement actions", () => {
    const candidate = trainStage9Candidate([]);

    expect(candidate.promoted).toBe(true);
    expect(candidate.candidateMetrics.priorityAccuracy)
      .toBeGreaterThan(candidate.baselineMetrics.priorityAccuracy);
    expect(candidate.candidateMetrics.highPriorityRecall)
      .toBeGreaterThanOrEqual(candidate.baselineMetrics.highPriorityRecall);
    expect(candidate.candidateMetrics.lowPriorityFalseHighRate)
      .toBeLessThanOrEqual(candidate.baselineMetrics.lowPriorityFalseHighRate);
    expect(candidate.candidateMetrics.authorityViolations).toBe(0);
    expect(candidate.candidateMetrics.harmfulResponseRate).toBe(0);

    for (const row of buildFrozenBenchmarkV3()) {
      const prediction = predictReviewPriority(candidate.model, row.features);
      expect(["HIGH", "MEDIUM", "LOW"]).toContain(prediction.priority);
      expect(prediction.reviewScore).toBeGreaterThanOrEqual(0);
      expect(prediction.reviewScore).toBeLessThanOrEqual(100);
    }
  });

  it("keeps deterministic ALLOW outside Verified Learning", () => {
    const allowed = { decision: "ALLOW", outcome: null } as any;
    expect(learningEntryReasons(allowed)).toEqual([]);
    expect(isLearningEligible(allowed)).toBe(false);
  });

  it("maps immutable human outcomes onto residual review priority without adding authority", () => {
    expect(humanOutcomeToPriority("REVIEW")).toBe("HIGH");
    expect(humanOutcomeToPriority("OBSERVE")).toBe("MEDIUM");
    expect(humanOutcomeToPriority("ABSTAIN")).toBe("LOW");
  });
});
