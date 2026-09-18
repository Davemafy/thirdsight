import { verifyGitHubActionsOidc } from "../src/infrastructure/auth/github-actions-oidc.js";
import { businessEventEvidence } from "../src/domain/evidence-sources.js";
import { enrichEvidenceGraph } from "../src/domain/evidence-verification.js";
import { decideVerification, verifyObservedFields } from "../src/domain/deterministic-verifier.js";
import { assessPerfectMimicBlindSpot } from "../src/domain/blind-spot-assessment.js";
import { resolveIntegrationIdentity } from "../src/domain/integration-identity.js";
import { ingestBrowserObservation } from "../src/infrastructure/browser-evidence/browser-observation-ingestion.js";
import { SupabaseEvidenceHistoryStore } from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";
import type { EvidenceHistoryEntry } from "../src/infrastructure/evidence-history/evidence-history-store.js";

interface ApiRequest { method?: string; headers?: Record<string,string|string[]|undefined> }
interface ApiResponse { status(code:number):ApiResponse; setHeader(name:string,value:string):void; json(body:unknown):void }

const ENVIRONMENT="production";
const INTEGRATION_ID="analytics-partner";
const DESTINATION="https://analytics.example/collect";
const FIELDS=["product.id","product.category","product.price"] as const;

export default async function handler(request:ApiRequest,response:ApiResponse):Promise<void>{
  response.setHeader("Cache-Control","no-store");
  if(request.method!=="POST"){response.status(405).json({error:"METHOD_NOT_ALLOWED"});return;}
  const token=readBearer(request);
  if(!token||!(await verifyGitHubActionsOidc(token,"thirdsight-stage7-perfect-mimic",".github/workflows/stage7-perfect-mimic.yml"))){
    response.status(401).json({error:"UNAUTHORIZED"});return;
  }
  const cfg=readConfig();
  if(!cfg){response.status(503).json({error:"PERSISTENCE_NOT_CONFIGURED"});return;}

  try{
    const store=new SupabaseEvidenceHistoryStore({projectUrl:cfg.supabaseUrl,serviceRoleKey:cfg.serviceRoleKey});
    const observedAt=new Date().toISOString();
    const runId=String(Date.now());
    const event=businessEventEvidence({
      id:`perfect-mimic-product-view-${runId}`,
      type:"product.viewed",
      timestamp:observedAt,
      orderRefHash:`perfect-mimic-order-${runId}`,
      integrationId:INTEGRATION_ID,
    });
    await store.appendBusinessEvent(event);

    const observation={
      schemaVersion:"browser-observation.v1" as const,
      observationId:`perfect-mimic-${runId}`,
      sensorId:"commerce-lab:perfect-mimic",
      observedAt,
      pageUrl:"https://commerce-lab.example/products/perfect-mimic",
      destinationUrl:DESTINATION,
      method:"POST",
      resourceType:"Fetch",
      initiatorType:"script",
      hasPostData:true,
      businessObjectRefs:{orderRefHash:event.event.orderRefHash!},
    };

    const base=ingestBrowserObservation(observation,observedAt);
    const bindings=await store.findActiveOriginBindings(new URL(DESTINATION).origin,ENVIRONMENT,observedAt);
    const resolved=resolveIntegrationIdentity(base.evidence,bindings,ENVIRONMENT);
    if(!resolved.evidence.integrationId) throw new Error("Perfect-mimic integration identity did not resolve.");

    const [contracts,capabilities]=await Promise.all([
      store.findPurposeContracts(INTEGRATION_ID,ENVIRONMENT,observedAt),
      store.findCapabilities(INTEGRATION_ID,ENVIRONMENT,observedAt),
    ]);
    let evidence=enrichEvidenceGraph(resolved.evidence,{purposeContracts:contracts,capabilities,businessEvents:[event]});
    if(evidence.did.value){
      evidence={...evidence,did:{...evidence.did,value:{...evidence.did.value,dataCategories:FIELDS}}};
    }

    const findings=verifyObservedFields(evidence,FIELDS,contracts);
    const decision=decideVerification(findings);
    if(findings.length!==0||decision!=="ALLOW"){
      throw new Error("Perfect-mimic benchmark must remain indistinguishable from legitimate traffic to the deterministic detector.");
    }
    if(evidence.why.status!=="KNOWN"||evidence.should.status!=="KNOWN"){
      throw new Error("Perfect-mimic evidence must be purpose-consistent across SHOULD/DID/WHY.");
    }

    const blindSpotAssessment=assessPerfectMimicBlindSpot(evidence,findings);
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
      blindSpotAssessment,
    };
    await store.append(entry);

    response.status(200).json({
      ok:true,
      scenario:"perfect-mimic-known-blind-spot",
      benchmarkGroundTruth:"COMPROMISED_ACTOR_BEHIND_PURPOSE_CONSISTENT_REQUEST",
      recordId:entry.recordId,
      decision,
      findings:findings.length,
      should:evidence.should.status,
      did:evidence.did.status,
      why:evidence.why.status,
      blindSpotAssessment,
      note:"The benchmark knows the actor is compromised. ThirdSight does not infer that hidden fact from evidence that is otherwise identical to a legitimate request.",
    });
  }catch(error){
    console.error("[ThirdSight] Stage 7 perfect-mimic proof failed.",error);
    response.status(500).json({error:"PERFECT_MIMIC_PROOF_FAILED",message:error instanceof Error?error.message:"Unknown failure"});
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
