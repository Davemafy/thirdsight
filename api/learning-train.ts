import {
  STAGE9_ALGORITHM,
  trainStage9Candidate,
} from "../src/learning-loop/learning-loop.js";
import { SupabaseLearningStore } from "../src/learning-loop/supabase-learning-store.js";

interface ApiRequest {
  method?: string;
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
  if(request.method!=="POST"){response.status(405).json({error:"METHOD_NOT_ALLOWED"});return;}
  if(!sameOriginBrowserRequest(request)){response.status(403).json({error:"SAME_ORIGIN_REQUIRED"});return;}

  const runtime=globalThis as typeof globalThis & {process?:{env?:Record<string,string|undefined>}};
  const url=runtime.process?.env?.THIRDSIGHT_SUPABASE_URL?.trim();
  const key=runtime.process?.env?.THIRDSIGHT_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!url||!key){response.status(503).json({error:"PERSISTENCE_NOT_CONFIGURED"});return;}

  try{
    const store=new SupabaseLearningStore({projectUrl:url,serviceRoleKey:key});
    const feedback=await store.listFeedback();
    const existing=await store.latestRunForHumanCount(feedback.length);
    if(existing){
      const active=await store.latestPromotedRun();
      response.status(200).json({
        ok:true,
        reused:true,
        run:publicRun(existing),
        activePromotion:active?publicRun(active):null,
        note:"No new verified examples were available, so ThirdSight reused the existing candidate for this dataset version.",
      });
      return;
    }

    const candidate=trainStage9Candidate(store.toLearningExamples(feedback));
    const runId=`stage9-learning-${candidate.modelVersion}`;
    const persisted=await store.appendRun(runId,candidate,STAGE9_ALGORITHM);
    const active=await store.latestPromotedRun();
    response.status(201).json({
      ok:true,
      reused:false,
      run:publicRun(persisted),
      activePromotion:active?publicRun(active):null,
      boundary:"Candidate training is advisory-only. Stage 7 deterministic verification and Stage 8 authority rules are unchanged.",
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
