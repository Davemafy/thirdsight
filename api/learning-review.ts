import { SupabaseEvidenceHistoryStore } from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";
import {
  extractLearningFeatures,
  isLearningEligible,
  type LearningLabel,
} from "../src/learning-loop/learning-loop.js";
import { SupabaseLearningStore } from "../src/learning-loop/supabase-learning-store.js";

interface ApiRequest {
  method?: string;
  body?: unknown;
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

  const body=parseBody(request.body);
  const recordId=typeof body?.recordId==="string"?body.recordId.trim():"";
  const label=body?.label;
  if(!recordId||!isLearningLabel(label)){
    response.status(400).json({error:"INVALID_REVIEW"});return;
  }

  try{
    const evidenceStore=new SupabaseEvidenceHistoryStore({projectUrl:url,serviceRoleKey:key});
    const learningStore=new SupabaseLearningStore({projectUrl:url,serviceRoleKey:key});
    const history=await evidenceStore.list(750);
    const entry=history.find((item)=>item.recordId===recordId);
    if(!entry){response.status(404).json({error:"EVIDENCE_RECORD_NOT_FOUND"});return;}
    if(!isLearningEligible(entry)){
      response.status(409).json({error:"NOT_LEARNING_ELIGIBLE",reason:"Only ambiguous advisory cases can become human-verified learning examples."});return;
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
        ?"Verified outcome appended. This record cannot be silently relabelled."
        :"This record already had a verified outcome; the original label was preserved.",
      storedFields:"PII-minimized structured features + advisory label only",
    });
  }catch(error){
    response.status(503).json({
      error:"LEARNING_REVIEW_FAILED",
      message:error instanceof Error?error.message:"unknown",
    });
  }
}

function isLearningLabel(value:unknown):value is LearningLabel{
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
