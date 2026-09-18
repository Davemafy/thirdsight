import { writeFile } from "node:fs/promises";
import {
  buildAiAnalystInput,
  enforceAiAuthority,
  isAiEligibleAmbiguity,
  type AiAnalystAssessment,
} from "../src/ai-analyst/ai-analyst.js";
import {
  compareAiModes,
  evaluateAiOff,
  evaluateAiOn,
} from "../src/ai-analyst/ai-evaluation.js";
import {
  buildFreshAmbiguousCasesV3,
  FRESH_AMBIGUOUS_BENCHMARK_V3_ID,
} from "../src/ai-analyst/fresh-ambiguous-v3.js";

const MODEL="qwen/qwen3.8-27b";
const MODEL_LABEL=`${MODEL}@groq-high`;
const ANALYST_VERSION="stage8-v3";
const GROQ_EDGE_URL="https://rxqlqirmmkhcavocbzcn.supabase.co/functions/v1/thirdsight-stage8-groq";
const CHUNK_SIZE=1;
const COOLDOWN_MS=62_000;

const cases=buildFreshAmbiguousCasesV3();
const ineligible=cases.filter((item)=>!isAiEligibleAmbiguity(item.evidence,item.decision));
if(ineligible.length>0){
  throw new Error(`Fresh v3 benchmark contains non-ambiguous cases: ${ineligible.map((item)=>item.caseId).join(", ")}`);
}

const inputs=cases.map((item)=>buildAiAnalystInput(item.evidence,item.decision,item.findings));
console.log(`Evaluating ${MODEL_LABEL} on ${cases.length} unseen cases (${FRESH_AMBIGUOUS_BENCHMARK_V3_ID})...`);

const rawResults:Array<{recordId?:string;ok?:boolean;assessment?:unknown;error?:string}>=[];
for(let start=0;start<inputs.length;start+=CHUNK_SIZE){
  const batch=inputs.slice(start,start+CHUNK_SIZE);
  const batchNumber=Math.floor(start/CHUNK_SIZE)+1;
  const batchCount=Math.ceil(inputs.length/CHUNK_SIZE);
  console.log(`Groq Qwen batch ${batchNumber}/${batchCount}: ${batch.length} case(s)`);
  const edgeBody=await requestEdgeBatch(batch);
  rawResults.push(...edgeBody.results);
  if(start+CHUNK_SIZE<inputs.length){
    await new Promise((resolve)=>setTimeout(resolve,COOLDOWN_MS));
  }
}

const rawByRecord=new Map(rawResults.filter((item)=>typeof item.recordId==="string").map((item)=>[String(item.recordId),item] as const));
const results=inputs.map((input,index)=>{
  const raw=rawByRecord.get(input.recordId);
  if(!raw||raw.ok!==true){
    const reason=raw?.error?.slice(0,600)??"Groq evaluation omitted this record.";
    console.log(`[${index+1}/${cases.length}] ${cases[index].caseId}: REJECTED — ${reason}`);
    return rejectedResult(input.recordId,reason,raw??null);
  }
  try{
    const candidate=normalizeAssessment(raw.assessment);
    const assessment=enforceAiAuthority(candidate,new Set(input.allowedEvidenceRefs));
    console.log(`[${index+1}/${cases.length}] ${cases[index].caseId}: ${assessment.recommended_response} / ${assessment.assessment}`);
    return {recordId:input.recordId,model:MODEL_LABEL,accepted:true,authorityViolation:false,assessment,rawAssessment:raw.assessment};
  }catch(error){
    const reason=error instanceof Error?error.message:"Authority validation failed.";
    console.log(`[${index+1}/${cases.length}] ${cases[index].caseId}: REJECTED — ${reason}`);
    return rejectedResult(input.recordId,reason,raw.assessment??null);
  }
});

const aiOff=evaluateAiOff(cases);
const aiOn=evaluateAiOn(cases,results);
const comparison=compareAiModes(aiOff,aiOn);
const runId=`stage8-qwen38-ai-${Date.now()}`;
const now=new Date().toISOString();

const report={
  ok:true,
  stage:"Stage 8 — AI analyst",
  analystVersion:ANALYST_VERSION,
  benchmarkId:FRESH_AMBIGUOUS_BENCHMARK_V3_ID,
  provider:"groq-cloud",
  model:MODEL_LABEL,
  reasoningEffort:"high",
  strictStructuredOutput:true,
  frozenDetector:"stage7-v1-frozen",
  detectorModified:false,
  factualEvidenceMutatedByAi:false,
  rawPayloadsSentToAi:false,
  piiValuesSentToAi:false,
  heldOutCases:cases.length,
  aiOff:aiOff.metrics,
  aiOn:aiOn.metrics,
  improvement:comparison.improvement,
  surfaceProminently:comparison.surfaceProminently,
  surfaceReason:comparison.surfaceReason,
  authorityViolations:aiOn.metrics.authorityViolations,
  rejectedAssessments:results.filter((result)=>!result.accepted).length,
  acceptedAssessments:results.filter((result)=>result.accepted).length,
  runId,
  cases:cases.map((item,index)=>({
    caseId:item.caseId,
    family:item.family,
    recordId:item.evidence.recordId,
    expectedRecommendations:item.expectedRecommendations,
    shouldAbstain:item.shouldAbstain,
    deterministicDecision:item.decision,
    ai:{
      accepted:results[index].accepted,
      assessment:results[index].assessment.assessment,
      confidence:results[index].assessment.confidence,
      recommendedResponse:results[index].assessment.recommended_response,
      evidenceUsed:results[index].assessment.evidence_used,
      unsupportedAssumptions:results[index].assessment.unsupported_assumptions,
      explanation:results[index].assessment.explanation,
    },
  })),
};

const evidenceRows=cases.map((item)=>({
  record_id:item.evidence.recordId,
  observation_id:item.observation.observationId,
  accepted_at:item.evidence.observedAt,
  observed_at:item.evidence.observedAt,
  destination_origin:item.evidence.did.value?.destinationOrigin??null,
  integration_id:item.evidence.integrationId,
  integration_resolution:item.evidence.integrationResolution,
  payload:{
    recordId:item.evidence.recordId,
    observationId:item.observation.observationId,
    acceptedAt:item.evidence.observedAt,
    observation:item.observation,
    evidence:item.evidence,
    integrationResolution:item.resolution,
    findings:item.findings,
    enforcement:null,
    outcome:null,
    decision:item.decision,
    containment:null,
    blindSpotAssessment:null,
  },
  findings:item.findings,
  enforcement:null,
  outcome:null,
}));

const assessmentRows=cases.map((item,index)=>({
  assessment_id:`ai:${ANALYST_VERSION}:${item.evidence.recordId}:${runId}`,
  record_id:item.evidence.recordId,
  analyst_version:ANALYST_VERSION,
  model:MODEL_LABEL,
  evaluation_case_id:item.caseId,
  input_snapshot:inputs[index],
  output:results[index].assessment,
  accepted:results[index].accepted,
  authority_violation:results[index].authorityViolation,
  created_at:now,
}));

const evaluationRow={
  run_id:runId,
  analyst_version:ANALYST_VERSION,
  model:MODEL_LABEL,
  case_count:cases.length,
  ai_off:aiOff,
  ai_on:aiOn,
  improvement:{...comparison.improvement,benchmarkId:FRESH_AMBIGUOUS_BENCHMARK_V3_ID,provider:"groq-cloud",reasoningEffort:"high",strictStructuredOutput:true},
  surface_prominently:comparison.surfaceProminently,
  surface_reason:comparison.surfaceReason,
  created_at:now,
};

await writeFile("stage8-ai-evaluation-v3.json",JSON.stringify(report,null,2));
await writeFile("stage8-ai-ingest-v3.json",JSON.stringify({schemaVersion:"stage8-ai-ingest.v1",evidenceRows,assessmentRows,evaluationRow},null,2));
console.log("THIRDSIGHT_STAGE8_V3_METRICS="+JSON.stringify({model:report.model,aiOff:report.aiOff,aiOn:report.aiOn,improvement:report.improvement,surfaceProminently:report.surfaceProminently,acceptedAssessments:report.acceptedAssessments,rejectedAssessments:report.rejectedAssessments}));

async function requestEdgeBatch(batch:readonly (typeof inputs)[number][]):Promise<{results:Array<{recordId?:string;ok?:boolean;assessment?:unknown;error?:string}>}>{
  const authToken=await getGroqOidcToken();
  const edgeResponse=await fetch(GROQ_EDGE_URL,{
    method:"POST",
    headers:{authorization:`Bearer ${authToken}`,"content-type":"application/json"},
    body:JSON.stringify({schemaVersion:"stage8-groq.v2",model:MODEL,cases:batch.map((input)=>({recordId:input.recordId,structuredEvidence:input}))}),
  });
  if(!edgeResponse.ok){
    const detail=(await edgeResponse.text()).slice(0,1200);
    throw new Error(`ThirdSight Groq boundary returned ${edgeResponse.status}: ${detail}`);
  }
  const edgeBody=(await edgeResponse.json()) as {ok?:boolean;provider?:string;model?:string;strictStructuredOutput?:boolean;results?:Array<{recordId?:string;ok?:boolean;assessment?:unknown;error?:string}>};
  if(edgeBody.ok!==true||edgeBody.provider!=="groq"||edgeBody.model!==MODEL||edgeBody.strictStructuredOutput!==true||!Array.isArray(edgeBody.results)){
    throw new Error("Groq evaluation boundary returned an invalid envelope.");
  }
  return {results:edgeBody.results};
}

async function getGroqOidcToken():Promise<string>{
  const requestUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL?.trim();
  const requestToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN?.trim();
  if(!requestUrl||!requestToken) throw new Error("GitHub OIDC environment is unavailable.");
  const separator=requestUrl.includes("?")?"&":"?";
  const response=await fetch(`${requestUrl}${separator}audience=thirdsight-stage8-groq`,{headers:{authorization:`bearer ${requestToken}`}});
  if(!response.ok) throw new Error(`GitHub OIDC refresh failed (${response.status}).`);
  const body=(await response.json()) as {value?:string};
  if(typeof body.value!=="string"||body.value.length===0) throw new Error("GitHub OIDC refresh returned no token.");
  return body.value;
}

function normalizeAssessment(value:unknown):AiAnalystAssessment{
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new Error("Groq assessment is not an object.");
  const raw=value as Record<string,unknown>;
  return {
    assessment:String(raw.assessment??"") as AiAnalystAssessment["assessment"],
    evidence_used:Array.isArray(raw.evidence_used)?raw.evidence_used.map(String):[],
    unsupported_assumptions:Array.isArray(raw.unsupported_assumptions)?raw.unsupported_assumptions.map(String):[],
    confidence:String(raw.confidence??"") as AiAnalystAssessment["confidence"],
    recommended_response:String(raw.recommended_response??"") as AiAnalystAssessment["recommended_response"],
    explanation:String(raw.explanation??""),
  };
}

function rejectedResult(recordId:string,reason:string,rawAssessment:unknown){
  return {
    recordId,model:MODEL_LABEL,accepted:false,authorityViolation:true,rawAssessment,
    assessment:{
      assessment:"INSUFFICIENT_EVIDENCE" as const,
      evidence_used:[],
      unsupported_assumptions:[reason],
      confidence:"LOW" as const,
      recommended_response:"ABSTAIN" as const,
      explanation:"The AI output failed ThirdSight's advisory authority boundary and was not accepted.",
    },
  };
}
