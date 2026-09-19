import { SupabaseEvidenceHistoryStore } from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";
import {
  STAGE9_ALGORITHM,
  STAGE9_BENCHMARK_ID,
  extractLearningFeatures,
  isLearningEligible,
  learningEntryReasons,
  predictReviewPriority,
  trainStage9Candidate,
  type HumanReviewOutcome,
} from "../src/learning-loop/learning-loop.js";
import { SupabaseLearningStore } from "../src/learning-loop/supabase-learning-store.js";

interface ApiRequest {
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  headers?: Record<string, string | string[] | undefined>;
}
interface ApiResponse {
  status(code:number):ApiResponse;
  setHeader(name:string,value:string):void;
  json(body:unknown):void;
  end():void;
}

export default async function handler(request:ApiRequest,response:ApiResponse):Promise<void>{
  response.setHeader("Cache-Control","no-store");
  if(request.method==="OPTIONS"){response.status(204).end();return;}

  const runtime=globalThis as typeof globalThis & {process?:{env?:Record<string,string|undefined>}};
  const url=runtime.process?.env?.THIRDSIGHT_SUPABASE_URL?.trim();
  const key=runtime.process?.env?.THIRDSIGHT_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!url||!key){response.status(503).json({error:"PERSISTENCE_NOT_CONFIGURED"});return;}

  const learningStore=new SupabaseLearningStore({projectUrl:url,serviceRoleKey:key});

  if(request.method==="GET"){
    await status(request,response,url,key,learningStore);
    return;
  }

  if(request.method!=="POST"){response.status(405).json({error:"METHOD_NOT_ALLOWED"});return;}
  if(!sameOriginBrowserRequest(request)){response.status(403).json({error:"SAME_ORIGIN_REQUIRED"});return;}

  const body=parseBody(request.body);
  if(body?.action==="review"){
    await review(body,response,url,key,learningStore);
    return;
  }
  if(body?.action==="train"){
    await train(response,learningStore);
    return;
  }
  response.status(400).json({error:"INVALID_ACTION"});
}

async function status(
  request:ApiRequest,
  response:ApiResponse,
  url:string,
  key:string,
  learningStore:SupabaseLearningStore,
){
  try{
    const [feedback,latestRun,activePromotion]=await Promise.all([
      learningStore.listFeedback(),
      learningStore.latestRun(STAGE9_BENCHMARK_ID),
      learningStore.latestPromotedRun(STAGE9_BENCHMARK_ID),
    ]);

    const recordId=queryValue(request.query?.recordId);
    let recordFeedback=null;
    let prediction=null;
    let eligible=false;
    let reasons:readonly string[]=[];

    if(recordId){
      recordFeedback=await learningStore.feedbackForRecord(recordId);
      const evidenceStore=new SupabaseEvidenceHistoryStore({projectUrl:url,serviceRoleKey:key});
      const entry=await evidenceStore.findByRecordId(recordId);
      if(entry){
        reasons=learningEntryReasons(entry);
        eligible=isLearningEligible(entry);
        if(activePromotion&&eligible){
          prediction=predictReviewPriority(activePromotion.model,extractLearningFeatures(entry));
        }
      }
    }

    response.status(200).json({
      ok:true,
      layer:"VERIFIED_LEARNING",
      thesis:"ThirdSight proves what can be proven, and learns where proof stops.",
      benchmark:STAGE9_BENCHMARK_ID,
      verifiedExamples:feedback.length,
      latestRun:latestRun?publicRun(latestRun):null,
      activePromotion:activePromotion?publicRun(activePromotion):null,
      record:{
        recordId:recordId||null,
        eligible,
        reasons,
        feedback:recordFeedback,
        activePrediction:prediction,
      },
      authority:{
        learnedOutput:["HIGH","MEDIUM","LOW"],
        humanOutcomes:["REVIEW","OBSERVE","ABSTAIN"],
        forbidden:["CONSTRAIN","ISOLATE","rewrite evidence","change Purpose Contract","change deterministic result"],
        statement:"Advisory only — deterministic enforcement unchanged.",
      },
    });
  }catch(error){
    response.status(503).json({
      error:"LEARNING_STATUS_FAILED",
      message:error instanceof Error?error.message:"unknown",
    });
  }
}

async function review(
  body:any,
  response:ApiResponse,
  url:string,
  key:string,
  learningStore:SupabaseLearningStore,
){
  const recordId=typeof body?.recordId==="string"?body.recordId.trim():"";
  const label=body?.label;
  if(!recordId||!isHumanOutcome(label)){
    response.status(400).json({error:"INVALID_REVIEW"});return;
  }

  try{
    const evidenceStore=new SupabaseEvidenceHistoryStore({projectUrl:url,serviceRoleKey:key});
    const entry=await evidenceStore.findByRecordId(recordId);
    if(!entry){response.status(404).json({error:"EVIDENCE_RECORD_NOT_FOUND"});return;}
    if(!isLearningEligible(entry)){
      response.status(409).json({
        error:"NOT_LEARNING_ELIGIBLE",
        reason:"Verified Learning only accepts unresolved third-party cases after deterministic verification stops without CONSTRAIN / ISOLATE authority.",
      });
      return;
    }

    const features=extractLearningFeatures(entry);
    const result=await learningStore.appendFeedback({recordId,label,features});
    const feedback=await learningStore.listFeedback();
    response.status(result.inserted?201:200).json({
      ok:true,
      inserted:result.inserted,
      feedback:result.feedback,
      verifiedExamples:feedback.length,
      immutability:result.inserted
        ?"Verified human outcome appended. This evidence record cannot be silently relabelled."
        :"This evidence record already had a verified human outcome; the original was preserved.",
      storedFields:"PII-minimized residual-evidence features + human-confirmed advisory outcome only",
    });
  }catch(error){
    response.status(503).json({
      error:"LEARNING_REVIEW_FAILED",
      message:error instanceof Error?error.message:"unknown",
    });
  }
}

async function train(
  response:ApiResponse,
  learningStore:SupabaseLearningStore,
){
  try{
    const feedback=await learningStore.listFeedback();
    const existing=await learningStore.latestRunForHumanCount(feedback.length,STAGE9_BENCHMARK_ID);
    if(existing){
      const active=await learningStore.latestPromotedRun(STAGE9_BENCHMARK_ID);
      response.status(200).json({
        ok:true,
        reused:true,
        run:publicRun(existing),
        activePromotion:active?publicRun(active):null,
        note:"No new verified outcomes were available for this benchmark version, so ThirdSight reused the existing candidate.",
      });
      return;
    }

    const candidate=trainStage9Candidate(learningStore.toLearningExamples(feedback));
    const runId=`stage9-learning-${candidate.modelVersion}`;
    const persisted=await learningStore.appendRun(runId,candidate,STAGE9_ALGORITHM);
    const active=await learningStore.latestPromotedRun(STAGE9_BENCHMARK_ID);
    response.status(201).json({
      ok:true,
      reused:false,
      run:publicRun(persisted),
      activePromotion:active?publicRun(active):null,
      boundary:"Verified Learning only prioritizes unresolved review. Stage 7 deterministic verification and Stage 8 AI authority remain unchanged.",
    });
  }catch(error){
    response.status(503).json({
      error:"LEARNING_TRAIN_FAILED",
      message:error instanceof Error?error.message:"unknown",
    });
  }
}

function publicRun(run:any){
  return {
    runId:run.runId,
    modelVersion:run.modelVersion,
    algorithm:run.algorithm,
    trainingExamples:run.trainingExamples,
    humanVerifiedExamples:run.humanVerifiedExamples,
    benchmarkId:run.benchmarkId,
    baselineMetrics:run.baselineMetrics,
    candidateMetrics:run.candidateMetrics,
    promoted:run.promoted,
    promotionReason:run.promotionReason,
    createdAt:run.createdAt,
  };
}

function isHumanOutcome(value:unknown):value is HumanReviewOutcome{
  return value==="REVIEW"||value==="OBSERVE"||value==="ABSTAIN";
}

function parseBody(body:unknown):any{
  if(typeof body==="string"){
    try{return JSON.parse(body);}catch{return null;}
  }
  return body&&typeof body==="object"?body:null;
}

function sameOriginBrowserRequest(request:ApiRequest):boolean{
  const origin=header(request,"origin");
  const host=header(request,"x-forwarded-host")||header(request,"host");
  const fetchSite=header(request,"sec-fetch-site");
  if(!origin||!host)return false;
  try{
    const parsed=new URL(origin);
    if(parsed.host!==host)return false;
  }catch{return false;}
  return !fetchSite||fetchSite==="same-origin";
}

function header(request:ApiRequest,name:string):string{
  const value=request.headers?.[name];
  return Array.isArray(value)?value[0]??"":value??"";
}

function queryValue(value:string|string[]|undefined):string{
  return Array.isArray(value)?value[0]??"":value??"";
}
