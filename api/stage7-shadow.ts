import { verifyGitHubActionsOidc } from "../src/infrastructure/auth/github-actions-oidc.js";
import { decideVerification, verifyShadowIntegration } from "../src/domain/deterministic-verifier.js";
import { resolveIntegrationIdentity } from "../src/domain/integration-identity.js";
import { ingestBrowserObservation } from "../src/infrastructure/browser-evidence/browser-observation-ingestion.js";
import { SupabaseEvidenceHistoryStore } from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";
import type { EvidenceHistoryEntry } from "../src/infrastructure/evidence-history/evidence-history-store.js";

interface ApiRequest { method?: string; headers?: Record<string,string|string[]|undefined> }
interface ApiResponse { status(code:number):ApiResponse; setHeader(name:string,value:string):void; json(body:unknown):void }

const ENVIRONMENT="production";

export default async function handler(request:ApiRequest,response:ApiResponse):Promise<void>{
  response.setHeader("Cache-Control","no-store");
  if(request.method!=="POST"){response.status(405).json({error:"METHOD_NOT_ALLOWED"});return;}
  const token=readBearer(request);
  if(!token||!(await verifyGitHubActionsOidc(token,"thirdsight-stage7-shadow",".github/workflows/stage7-shadow.yml"))){
    response.status(401).json({error:"UNAUTHORIZED"});return;
  }
  const cfg=readConfig();
  if(!cfg){response.status(503).json({error:"PERSISTENCE_NOT_CONFIGURED"});return;}

  try{
    const store=new SupabaseEvidenceHistoryStore({projectUrl:cfg.supabaseUrl,serviceRoleKey:cfg.serviceRoleKey});
    const observedAt=new Date().toISOString();
    const observation={
      schemaVersion:"browser-observation.v1" as const,
      observationId:`shadow-pixel-${Date.now()}`,
      sensorId:"commerce-lab:shadow-pixel",
      observedAt,
      pageUrl:"https://commerce-lab.example/products/sku-shadow",
      destinationUrl:"https://shadowpixel.invalid/pixel",
      method:"POST",
      resourceType:"Fetch",
      initiatorType:"script",
      hasPostData:true,
    };
    const base=ingestBrowserObservation(observation,observedAt);
    const resolved=resolveIntegrationIdentity(base.evidence,[],ENVIRONMENT);
    const evidence=resolved.evidence;
    const findings=verifyShadowIntegration(evidence,{managedEnvironment:true,integrationInventoryComplete:true});
    const decision=decideVerification(findings);

    if(findings.length!==1||findings[0]?.type!=="SHADOW_INTEGRATION"||decision!=="OBSERVE"){
      throw new Error("Opaque shadow integration was not surfaced conservatively.");
    }
    if(evidence.did.value?.dataCategories!==undefined) throw new Error("Opaque payload was assigned invented data categories.");

    const entry:EvidenceHistoryEntry={
      recordId:evidence.recordId,
      observationId:observation.observationId,
      acceptedAt:observedAt,
      observation,
      evidence,
      integrationResolution:resolved.resolution,
      findings,
      enforcement:null,
      outcome:null,
      decision,
      containment:null,
    };
    await store.append(entry);

    response.status(200).json({
      ok:true,
      scenario:"opaque-shadow-integration",
      recordId:entry.recordId,
      finding:"SHADOW_INTEGRATION",
      decision,
      integrationResolution:evidence.integrationResolution,
      dataCategories:evidence.did.value?.dataCategories??null,
      payloadSemantics:"UNKNOWN",
      outcome:null,
      note:"ThirdSight observes an unregistered managed-environment destination but does not invent payload semantics or claim malicious intent.",
    });
  }catch(error){
    console.error("[ThirdSight] Stage 7 shadow proof failed.",error);
    response.status(500).json({error:"SHADOW_PROOF_FAILED",message:error instanceof Error?error.message:"Unknown failure"});
  }
}

function readBearer(request:ApiRequest):string|null{
  const raw=request.headers?.authorization;
  const value=Array.isArray(raw)?raw[0]:raw;
  return typeof value==="string"&&value.startsWith("Bearer ")?value.slice(7):null;
}
function readConfig(){
  const runtime=globalThis as typeof globalThis & {process?:{env?:Record<string,string|undefined>}};
  const supabaseUrl=runtime.process?.env?.THIRDSIGHT_SUPABASE_URL?.trim();
  const serviceRoleKey=runtime.process?.env?.THIRDSIGHT_SUPABASE_SERVICE_ROLE_KEY?.trim();
  return supabaseUrl&&serviceRoleKey?{supabaseUrl,serviceRoleKey}:null;
}
