import { verifyGitHubActionsOidc } from "../src/infrastructure/auth/github-actions-oidc.js";
import { decideVerification, verifyIntegrationLifecycle } from "../src/domain/deterministic-verifier.js";
import { projectDbAuditObservationToEvidenceGraph, type DbAuditObservationV1 } from "../src/infrastructure/db-audit/db-audit-adapter.js";
import { SupabaseEvidenceHistoryStore } from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";
import type { EvidenceHistoryEntry } from "../src/infrastructure/evidence-history/evidence-history-store.js";
import type { IntegrationResolutionResult } from "../src/domain/integration-identity.js";

interface ApiRequest { method?: string; headers?: Record<string,string|string[]|undefined> }
interface ApiResponse { status(code:number):ApiResponse; setHeader(name:string,value:string):void; json(body:unknown):void }

const INTEGRATION_ID="legacy-crm";
const ENVIRONMENT="production";

export default async function handler(request:ApiRequest,response:ApiResponse):Promise<void>{
  response.setHeader("Cache-Control","no-store");
  if(request.method!=="POST"){response.status(405).json({error:"METHOD_NOT_ALLOWED"});return;}
  const token=readBearer(request);
  if(!token||!(await verifyGitHubActionsOidc(token,"thirdsight-stage7-stale-crm",".github/workflows/stage7-stale-crm.yml"))){
    response.status(401).json({error:"UNAUTHORIZED"});return;
  }
  const cfg=readConfig();
  if(!cfg){response.status(503).json({error:"PERSISTENCE_NOT_CONFIGURED"});return;}

  try{
    const store=new SupabaseEvidenceHistoryStore({projectUrl:cfg.supabaseUrl,serviceRoleKey:cfg.serviceRoleKey});
    const lifecycle=await store.findIntegrationLifecycle(INTEGRATION_ID);
    if(!lifecycle||lifecycle.lifecycleStatus!=="RETIRED") throw new Error("Legacy CRM must be retired for the stale-integration proof.");

    const observedAt=new Date().toISOString();
    const credentialId=`legacy-crm-db-${Date.now()}`;
    await store.registerCredential({credentialId,integrationId:INTEGRATION_ID,environment:ENVIRONMENT,validFrom:observedAt});

    const observation:DbAuditObservationV1={
      schemaVersion:"db-audit-observation.v1",
      observationId:`stale-crm-read-${Date.now()}`,
      sensorId:"commerce-lab:db-audit",
      observedAt,
      integrationId:INTEGRATION_ID,
      credentialId,
      database:"commerce-lab",
      resource:"public.customers",
      operation:"SELECT",
      dataCategories:["customer.email","customer.phone"],
    };
    const evidence=projectDbAuditObservationToEvidenceGraph(observation);
    const findings=verifyIntegrationLifecycle(evidence,{...lifecycle,credentialId});
    const decision=decideVerification(findings);
    if(findings.length!==1||findings[0]?.type!=="STALE_INTEGRATION"||decision!=="ISOLATE"){
      throw new Error("Stale CRM access did not produce STALE_INTEGRATION → ISOLATE.");
    }

    const isolated=await store.isolateCredential(credentialId);
    const credential=await store.findCredential(credentialId);
    if(!isolated||credential?.status!=="REVOKED") throw new Error("Legacy CRM credential isolation was not persisted.");

    const resolution:IntegrationResolutionResult={
      status:"RESOLVED",
      integrationId:INTEGRATION_ID,
      confidence:"AUTHORITATIVE",
      bindingIds:[],
      sourceIds:[`credential-registry:${credentialId}`],
      reason:"DB audit identity was resolved through the controlled credential registry.",
    };
    const entry:EvidenceHistoryEntry={
      recordId:evidence.recordId,
      observationId:observation.observationId,
      acceptedAt:observedAt,
      observation,
      evidence,
      integrationResolution:resolution,
      findings,
      enforcement:null,
      outcome:"DETECTED",
      decision,
      containment:{action:"ISOLATE",credentialId,applied:true},
    };
    await store.append(entry);

    response.status(200).json({
      ok:true,
      scenario:"stale-crm-direct-db-access",
      recordId:entry.recordId,
      boundary:"db-audit",
      finding:"STALE_INTEGRATION",
      decision,
      outcome:"DETECTED",
      credential:{credentialId,status:credential.status},
      gatewayTrafficObserved:false,
      note:"The database read had already occurred. ISOLATE contains future use; ThirdSight does not relabel the observed read as PREVENTED.",
    });
  }catch(error){
    console.error("[ThirdSight] Stage 7 stale CRM proof failed.",error);
    response.status(500).json({error:"STALE_CRM_PROOF_FAILED",message:error instanceof Error?error.message:"Unknown failure"});
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
