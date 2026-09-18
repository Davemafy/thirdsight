import { SupabaseEvidenceHistoryStore } from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";

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
    const history=await store.list(25);
    response.status(200).json({history:history.map(entry=>({
      recordId:entry.recordId,acceptedAt:entry.acceptedAt,observedAt:entry.evidence.observedAt,
      integrationId:entry.evidence.integrationId,integrationResolution:entry.evidence.integrationResolution,
      should:entry.evidence.should,could:entry.evidence.could,did:entry.evidence.did,why:entry.evidence.why,
      findings:entry.findings??[], enforcement:entry.enforcement??null, decision:entry.decision??null, coverage:entry.evidence.coverage??inferCoverage(entry.evidence.did.value?.boundary),
      outcome:entry.outcome??derivePassiveOutcome(entry.evidence.did.value?.phase)
    }))});
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
