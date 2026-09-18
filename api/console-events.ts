import { SupabaseEvidenceHistoryStore } from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";
import { SupabaseAiAssessmentStore } from "../src/ai-analyst/ai-assessment-store.js";

interface ApiRequest { method?: string }
interface ApiResponse { status(code:number):ApiResponse; setHeader(name:string,value:string):void; json(body:unknown):void; end():void }

export default async function handler(request:ApiRequest,response:ApiResponse):Promise<void>{
  response.setHeader("Cache-Control","no-store");
  if(request.method==="OPTIONS"){response.status(204).end();return;}
  if(request.method!=="GET"){response.status(405).json({error:"METHOD_NOT_ALLOWED"});return;}
  const runtime=globalThis as typeof globalThis & {process?:{env?:Record<string,string|undefined>}};
  const url=runtime.process?.env?.THIRDSIGHT_SUPABASE_URL?.trim();
  const key=runtime.process?.env?.THIRDSIGHT_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!url||!key){response.status(503).json({error:"PERSISTENCE_NOT_CONFIGURED"});return;}
  try{
    const store=new SupabaseEvidenceHistoryStore({projectUrl:url,serviceRoleKey:key});
    const aiStore=new SupabaseAiAssessmentStore({projectUrl:url,serviceRoleKey:key});
    const history=selectRepresentativeHistory(await store.list(650));
    const [latestAiEvaluation,promotedAiEvaluation]=await Promise.all([
      aiStore.latestEvaluationRun(),
      aiStore.latestPromotedEvaluationRun(),
    ]);
    const aiByRecord=promotedAiEvaluation
      ? await aiStore.latestForRecords(
          history.map((entry)=>entry.recordId),
          {
            analystVersion:promotedAiEvaluation.analystVersion,
            model:promotedAiEvaluation.model,
            acceptedOnly:true,
          },
        )
      : new Map();
    response.status(200).json({
      aiAnalyst:{
        promoted:Boolean(promotedAiEvaluation),
        activePromotion:promotedAiEvaluation,
        latestEvaluation:latestAiEvaluation,
      },
      history:history.map(entry=>({
      recordId:entry.recordId,acceptedAt:entry.acceptedAt,observedAt:entry.evidence.observedAt,
      integrationId:entry.evidence.integrationId,integrationResolution:entry.evidence.integrationResolution,
      should:entry.evidence.should,could:entry.evidence.could,did:entry.evidence.did,why:entry.evidence.why,
      findings:entry.findings??[], enforcement:entry.enforcement??null, containment:entry.containment??null, blindSpotAssessment:entry.blindSpotAssessment??null, decision:entry.decision??null, coverage:entry.evidence.coverage??inferCoverage(entry.evidence.did.value?.boundary),
      outcome:entry.outcome??derivePassiveOutcome(entry.evidence.did.value?.phase),
      aiAssessment:aiByRecord.get(entry.recordId)??null
    }))
    });
  }catch{response.status(503).json({error:"EVIDENCE_READ_FAILED"});}
}
function derivePassiveOutcome(phase:string|undefined):"DETECTED"|null{
  // Only post-access evidence may be labelled DETECTED. ATTEMPTED is not transmission proof.
  return phase==="TRANSMITTED"||phase==="ACCESSED"?"DETECTED":null;
}

function inferCoverage(boundary:string|undefined){
  if(boundary==="browser") return {label:"BROWSER_ONLY",boundaries:["browser"],limitations:["Only browser-visible request metadata is covered by this observation."]};
  return {label:"MULTI_BOUNDARY",boundaries:boundary?[boundary]:[],limitations:[]};
}


function selectRepresentativeHistory<T extends {
  recordId:string;
  outcome?:"PREVENTED"|"DETECTED"|null;
  decision?:"ALLOW"|"OBSERVE"|"CONSTRAIN"|"ISOLATE";
  findings?:readonly {type:string}[];
  blindSpotAssessment?:unknown;
  evidence:{
    integrationId:string|null;
    integrationResolution:string;
    should:{value?:{contractVersion?:string}|null};
    why:{value?:{correlationStrength?:string}|null};
    coverage?:{label?:string};
  };
}>(entries:readonly T[]):readonly T[]{
  const selected:T[]=[...entries.slice(0,40)];
  const add=(predicate:(entry:T)=>boolean)=>{const match=entries.find(predicate);if(match&&!selected.some((entry)=>entry.recordId===match.recordId))selected.push(match);};
  add((entry)=>Boolean(entry.blindSpotAssessment));
  add((entry)=>entry.findings?.some((finding)=>finding.type==="STALE_INTEGRATION")??false);
  add((entry)=>entry.findings?.some((finding)=>finding.type==="SHADOW_INTEGRATION")??false);
  add((entry)=>entry.findings?.some((finding)=>finding.type==="PURPOSE_MISMATCH")??false);
  add((entry)=>entry.findings?.some((finding)=>finding.type==="SCOPE_DRIFT")??false);
  add((entry)=>entry.evidence.should.value?.contractVersion==="4");
  add((entry)=>entry.evidence.should.value?.contractVersion==="5"&&entry.decision==="ALLOW");
  add((entry)=>entry.outcome==="PREVENTED");
  add((entry)=>entry.outcome==="DETECTED");
  add((entry)=>entry.evidence.coverage?.label==="BROWSER_ONLY"&&entry.evidence.integrationId===null);
  add((entry)=>entry.decision==="ALLOW"&&entry.evidence.why.value?.correlationStrength==="BUSINESS_OBJECT_HASH");
  return selected;
}
