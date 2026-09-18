import { describe, expect, it } from "vitest";
import {
  runDetectorEvaluation,
  UNSEEN_EVALUATION_SEEDS,
} from "./detector-evaluation.js";

describe("Stage 7 frozen-detector evaluation", () => {
  it("measures the frozen detector on seeds that were not used before the freeze", () => {
    const report = runDetectorEvaluation(UNSEEN_EVALUATION_SEEDS);

    expect(report.freezeId).toBe("stage7-v1");
    expect(report.detectorVersion).toBe("stage7-v1-frozen");
    expect(report.seeds).toEqual([...UNSEEN_EVALUATION_SEEDS]);
    expect(report.totals.cases).toBeGreaterThan(0);
    expect(report.metrics.precision).toBeGreaterThanOrEqual(0);
    expect(report.metrics.precision).toBeLessThanOrEqual(1);
    expect(report.metrics.recall).toBeGreaterThanOrEqual(0);
    expect(report.metrics.recall).toBeLessThanOrEqual(1);
    expect(report.metrics.falsePositiveRate).toBeGreaterThanOrEqual(0);
    expect(report.metrics.falsePositiveRate).toBeLessThanOrEqual(1);
    expect(report.metrics.legitimateTrafficDisrupted).toBeGreaterThanOrEqual(0);
    expect(report.metrics.unnecessaryAccessPrevented).toBeGreaterThanOrEqual(0);
    expect(report.metrics.knownBlindSpotFalseNegatives).toBeGreaterThan(0);

    console.log("THIRDSIGHT_EVALUATION_JSON=" + JSON.stringify(report));
  });
});
