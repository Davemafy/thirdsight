import { verifyGitHubActionsOidc } from "../src/infrastructure/auth/github-actions-oidc.js";
import { businessEventEvidence } from "../src/domain/evidence-sources.js";
import { enrichEvidenceGraph } from "../src/domain/evidence-verification.js";
import { decideVerification, verifyObservedFields } from "../src/domain/deterministic-verifier.js";
import { resolveIntegrationIdentity } from "../src/domain/integration-identity.js";
import { ingestBrowserObservation } from "../src/infrastructure/browser-evidence/browser-observation-ingestion.js";
import { SupabaseEvidenceHistoryStore } from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";
import type { EvidenceHistoryEntry } from "../src/infrastructure/evidence-history/evidence-history-store.js";

interface ApiRequest { method?: string; headers?: Record<string,string|string[]|undefined> }
interface ApiResponse { status(code:number):ApiResponse; setHeader(name:string,value:string):void; json(body:unknown):void }

const ENVIRONMENT="production";
const INTEGRATION_ID="analytics-partner";
const DESTINATION="https://analytics.example/collect";
const PRE_CHANGE="2026-09-18T10:59:59.000Z";
const POST_CHANGE="2026-09-18T11:00:01.000Z";
const BASE_FIELDS=["product.id","product.category","product.price"] as const;
const V5_FIELDS=[...BASE_FIELDS,"customer.loyalty_tier"] as const;

export default async function handler(request:ApiRequest,response:ApiResponse):Promise<void>{
  response.setHeader("Cache-Control","no-store");
  if(request.method!=="POST"){response.status(405).json({error:"METHOD_NOT_ALLOWED"});return;}
  const token=readBearer(request);
  if(!token||!(await verifyGitHubActionsOidc(token,"thirdsight-stage7-contract-version",".github/workflows/stage7-contract-version.yml"))){
    response.status(401).json({error:"UNAUTHORIZED"});return;
  }
  const cfg=readConfig();
  if(!cfg){response.status(503).json({error:"PERSISTENCE_NOT_CONFIGURED"});return;}

  try{
    const store=new SupabaseEvidenceHistoryStore({projectUrl:cfg.supabaseUrl,serviceRoleKey:cfg.serviceRoleKey});
    const runId=String(Date.now());
    const bindings=await store.findActiveOriginBindings(new URL(DESTINATION).origin,ENVIRONMENT,POST_CHANGE);

    const before=await runRecord(store,bindings,runId,"before",PRE_CHANGE,V5_FIELDS);
    const after=await runRecord(store,bindings,runId,"after",POST_CHANGE,V5_FIELDS);

    if(before.contractVersion!=="4"||before.decision!=="CONSTRAIN"||!before.findings.includes("SCOPE_DRIFT")){
      throw new Error("Pre-change request was not evaluated against Purpose Contract v4.");
    }
    if(after.contractVersion!=="5"||after.decision!=="ALLOW"||after.findings.length!==0){
      throw new Error("Post-change request was not evaluated against Purpose Contract v5.");
    }

    response.status(200).json({
      ok:true,
      scenario:"contract-version-change",
      transitionAt:"2026-09-18T11:00:00.000Z",
      before,
      after,
      invariant:"Historical evidence stays bound to the contract version active at observation time; runtime behavior never widens an earlier contract.",
    });
  }catch(error){
    console.error("[ThirdSight] Stage 7 contract-version proof failed.",error);
    response.status(500).json({error:"CONTRACT_VERSION_PROOF_FAILED",message:error instanceof Error?error.message:"Unknown failure"});
  }
}

async function runRecord(
  store:SupabaseEvidenceHistoryStore,
  bindings:Awaited<ReturnType<SupabaseEvidenceHistoryStore["findActiveOriginBindings"]>>,
  runId:string,
  label:"before"|"after",
  observedAt:string,
  observedFields:readonly string[],
){
  const event=businessEventEvidence({
    id:`stage7-contract-${label}-${runId}`,
    type:"product.viewed",
    timestamp:observedAt,
    orderRefHash:`stage7-contract-order-${label}-${runId}`,
    integrationId:INTEGRATION_ID,
  });
  await store.appendBusinessEvent(event);

  const observation={
    schemaVersion:"browser-observation.v1" as const,
    observationId:`stage7-contract-${label}-${runId}`,
    sensorId:"commerce-lab:contract-version",
    observedAt,
    pageUrl:`https://commerce-lab.example/products/contract-${label}`,
    destinationUrl:DESTINATION,
    method:"POST",
    resourceType:"Fetch",
    initiatorType:"script",
    hasPostData:true,
    businessObjectRefs:{orderRefHash:event.event.orderRefHash!},
  };

  const base=ingestBrowserObservation(observation,observedAt);
  const resolved=resolveIntegrationIdentity(base.evidence,bindings,ENVIRONMENT);
  if(!resolved.evidence.integrationId) throw new Error("Contract-version integration identity did not resolve.");

  const [contracts,capabilities]=await Promise.all([
    store.findPurposeContracts(INTEGRATION_ID,ENVIRONMENT,observedAt),
    store.findCapabilities(INTEGRATION_ID,ENVIRONMENT,observedAt),
  ]);

  let evidence=enrichEvidenceGraph(resolved.evidence,{purposeContracts:contracts,capabilities,businessEvents:[event]});
  if(evidence.did.value){
    evidence={...evidence,did:{...evidence.did,value:{...evidence.did.value,dataCategories:observedFields}}};
  }

  const findings=verifyObservedFields(evidence,observedFields,contracts);
  const decision=decideVerification(findings);
  const entry:EvidenceHistoryEntry={
    recordId:evidence.recordId,
    observationId:observation.observationId,
    acceptedAt:new Date().toISOString(),
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

  return {
    recordId:entry.recordId,
    observedAt,
    contractVersion:evidence.should.value?.contractVersion??null,
    approvedFields:evidence.should.value?.fields??[],
    observedFields,
    decision,
    findings:findings.map((finding)=>finding.type),
  };
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
