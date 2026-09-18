import { SupabaseEvidenceHistoryStore } from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";
import {
  extractLearningFeatures,
  isLearningEligible,
  predictLearningLabel,
} from "../src/learning-loop/learning-loop.js";
import { SupabaseLearningStore } from "../src/learning-loop/supabase-learning-store.js";

interface ApiRequest {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
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
  if(request.method!=="GET"){response.status(405).json({error:"METHOD_NOT_ALLOWED"});return;}

  const runtime=globalThis as typeof globalThis & {process?:{env?:Record<string,string|undefined>}};
  const url=runtime.process?.env?.THIRDSIGHT_SUPABASE_URL?.trim();
  const key=runtime.process?.env?.THIRDSIGHT_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!url||!key){response.status(503).json({error:"PERSISTENCE_NOT_CONFIGURED"});return;}

  try{
    const learningStore=new SupabaseLearningStore({projectUrl:url,serviceRoleKey:key});
    const [feedback,latestRun,activePromotion]=await Promise.all([
      learningStore.listFeedback(),
      learningStore.latestRun(),
      learningStore.latestPromotedRun(),
    ]);

    const recordId=queryValue(request.query?.recordId);
    let recordFeedback=null;
    let prediction:null|string=null;
    let eligible=false;
    if(recordId){
      recordFeedback=await learningStore.feedbackForRecord(recordId);
      const evidenceStore=new SupabaseEvidenceHistoryStore({projectUrl:url,serviceRoleKey:key});
      const history=await evidenceStore.list(750);
      const entry=history.find((item)=>item.recordId===recordId);
      if(entry){
        eligible=isLearningEligible(entry);
        if(activePromotion&&eligible){
          prediction=predictLearningLabel(activePromotion.model,extractLearningFeatures(entry));
        }
      }
    }

    response.status(200).json({
      ok:true,
      benchmark:"stage9-learning-v1-frozen",
      verifiedExamples:feedback.length,
      latestRun:latestRun?publicRun(latestRun):null,
      activePromotion:activePromotion?publicRun(activePromotion):null,
      record:{
        recordId:recordId||null,
        eligible,
        feedback:recordFeedback,
        activePrediction:prediction,
      },
      authority:{
        allowed:["REVIEW","OBSERVE","ABSTAIN"],
        forbidden:["CONSTRAIN","ISOLATE","rewrite evidence","change Purpose Contract"],
      },
    });
  }catch(error){
    response.status(503).json({
      error:"LEARNING_STATUS_FAILED",
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

function queryValue(value:string|string[]|undefined):string{
  return Array.isArray(value)?value[0]??"":value??"";
}
