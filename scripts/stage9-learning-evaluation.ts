import { writeFile } from "node:fs/promises";
import {
  STAGE9_ALGORITHM,
  STAGE9_BENCHMARK_ID,
  buildFrozenBenchmarkV3,
  buildSyntheticTrainingSet,
  trainStage9Candidate,
} from "../src/learning-loop/learning-loop.js";

const candidate=trainStage9Candidate([]);
const report={
  ok:true,
  stage:"Stage 9 — Verified Learning / residual review priority",
  thesis:"ThirdSight proves what can be proven, and learns where proof stops.",
  benchmarkId:STAGE9_BENCHMARK_ID,
  benchmarkCases:buildFrozenBenchmarkV3().length,
  syntheticSeedExamples:buildSyntheticTrainingSet().length,
  humanVerifiedExamples:0,
  algorithm:STAGE9_ALGORITHM,
  authority:{
    learnedOutput:["HIGH","MEDIUM","LOW"],
    humanOutcomes:["REVIEW","OBSERVE","ABSTAIN"],
    forbidden:["CONSTRAIN","ISOLATE","rewrite evidence","change Purpose Contract","change deterministic result"],
  },
  baselineMetrics:candidate.baselineMetrics,
  candidateMetrics:candidate.candidateMetrics,
  promoted:candidate.promoted,
  promotionReason:candidate.promotionReason,
  completedAt:new Date().toISOString(),
};
await writeFile("stage9-learning-evaluation.json",JSON.stringify(report,null,2));
console.log("THIRDSIGHT_STAGE9_VERIFIED_LEARNING="+JSON.stringify(report));
