import { writeFile } from "node:fs/promises";
import {
  STAGE9_ALGORITHM,
  STAGE9_BENCHMARK_ID,
  buildFrozenBenchmarkV1,
  buildSyntheticTrainingSet,
  trainStage9Candidate,
} from "../src/learning-loop/learning-loop.js";

const candidate=trainStage9Candidate([]);
const report={
  ok:true,
  stage:"Stage 9 — verified learning loop",
  benchmarkId:STAGE9_BENCHMARK_ID,
  benchmarkCases:buildFrozenBenchmarkV1().length,
  syntheticSeedExamples:buildSyntheticTrainingSet().length,
  humanVerifiedExamples:0,
  algorithm:STAGE9_ALGORITHM,
  authority:{
    allowed:["REVIEW","OBSERVE","ABSTAIN"],
    forbidden:["CONSTRAIN","ISOLATE","rewrite evidence","change Purpose Contract"],
  },
  baselineMetrics:candidate.baselineMetrics,
  candidateMetrics:candidate.candidateMetrics,
  promoted:candidate.promoted,
  promotionReason:candidate.promotionReason,
  completedAt:new Date().toISOString(),
};
await writeFile("stage9-learning-evaluation.json",JSON.stringify(report,null,2));
console.log("THIRDSIGHT_STAGE9_LEARNING="+JSON.stringify(report));
