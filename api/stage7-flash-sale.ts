import { verifyGitHubActionsOidc } from "../src/infrastructure/auth/github-actions-oidc.js";
import { businessEventEvidence } from "../src/domain/evidence-sources.js";
import { enrichEvidenceGraph } from "../src/domain/evidence-verification.js";
import { decideVerification, verifyObservedFields } from "../src/domain/deterministic-verifier.js";
import { resolveIntegrationIdentity } from "../src/domain/integration-identity.js";
import { ingestBrowserObservation } from "../src/infrastructure/browser-evidence/browser-observation-ingestion.js";
import { SupabaseEvidenceHistoryStore } from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";
import type { EvidenceHistoryEntry } from "../src/infrastructure/evidence-history/evidence-history-store.js";

interface ApiRequest { method?: string; headers?: Record<string,string|string[]|undefined> }
interface ApiResponse { status(code:number):ApiResponse; setHeader(name:string,value:string):void; json(body:unknown):void; end():void }

const ENVIRONMENT="production";
const INTEGRATION_ID="analytics-partner";
const DESTINATION="https://analytics.example/collect";
const APPROVED_FIELDS=["product.id","product.category","product.price"] as const;
const BASELINE=5;
const SPIKE=BASELINE*10;

export default async function handler(request:ApiRequest,response:ApiResponse):Promise<void>{
  response.setHeader("Cache-Control","no-store");
  if(request.method!=="POST"){response.status(405).json({error:"METHOD_NOT_ALLOWED"});return;}
  const token=readBearer(request);
  if(!token||!(await verifyGitHubActionsOidc(token,"thirdsight-stage7-flash-sale",".github/workflows/stage7-flash-sale.yml"))){
    response.status(401).json({error:"UNAUTHORIZED"});return;
  }
  const cfg=readConfig();
  if(!cfg){response.status(503).json({error:"PERSISTENCE_NOT_CONFIGURED"});return;}

  try{
    const store=new SupabaseEvidenceHistoryStore({projectUrl:cfg.supabaseUrl,serviceRoleKey:cfg.serviceRoleKey});
    const base=Date.now();
    const events=Array.from({length:SPIKE},(_,index)=>businessEventEvidence({
      id:`gate5-flash-sale-${index}`,
      type:"product.viewed",
      timestamp:new Date(base+index*100).toISOString(),
      orderRefHash:`gate5-order-hash-${index}`,
      integrationId:INTEGRATION_ID,
    }));
    await store.appendBusinessEvents(events);

    const observedAt=new Date(base).toISOString();
    const bindings=await store.findActiveOriginBindings(new URL(DESTINATION).origin,ENVIRONMENT,observedAt);
    const [contracts,capabilities]=await Promise.all([
      store.findPurposeContracts(INTEGRATION_ID,ENVIRONMENT,observedAt),
      store.findCapabilities(INTEGRATION_ID,ENVIRONMENT,observedAt),
    ]);

    const entries:EvidenceHistoryEntry[]=[];
    for(let index=0;index<SPIKE;index+=1){
      const timestamp=events[index].event.timestamp;
      const observation={
        schemaVersion:"browser-observation.v1" as const,
        observationId:`gate5-flash-sale-${index}`,
        sensorId:"commerce-lab:flash-sale",
        observedAt:timestamp,
        pageUrl:`https://commerce-lab.example/products/sku-${index}`,
        destinationUrl:DESTINATION,
        method:"POST",
        resourceType:"Fetch",
        initiatorType:"script",
        hasPostData:true,
        businessObjectRefs:{orderRefHash:`gate5-order-hash-${index}`},
      };

      const baseEvidence=ingestBrowserObservation(observation,timestamp);
      const resolved=resolveIntegrationIdentity(baseEvidence.evidence,bindings,ENVIRONMENT);
      if(!resolved.evidence.integrationId) throw new Error("Flash-sale integration identity did not resolve.");

      const evidence=enrichEvidenceGraph(resolved.evidence,{
        purposeContracts:contracts,
        capabilities,
        businessEvents:[events[index]],
      });
      const findings=verifyObservedFields(evidence,APPROVED_FIELDS,contracts);
      const decision=decideVerification(findings);

      if(evidence.why.status!=="KNOWN"||evidence.why.value?.correlationStrength!=="BUSINESS_OBJECT_HASH"){
        throw new Error(`Flash-sale request ${index} did not receive object-level WHY evidence.`);
      }
      if(findings.length!==0||decision!=="ALLOW"){
        throw new Error(`Flash-sale request ${index} produced a false alarm.`);
      }

      entries.push({
        recordId:evidence.recordId,
        observationId:observation.observationId,
        acceptedAt:timestamp,
        observation,
        evidence,
        integrationResolution:resolved.resolution,
        findings,
        enforcement:null,
        outcome:null,
        decision,
      });
    }

    await store.appendMany(entries);
    response.status(200).json({
      ok:true,
      scenario:"flash-sale-legitimate-spike",
      baselineRequests:BASELINE,
      spikeRequests:SPIKE,
      multiplier:SPIKE/BASELINE,
      decisions:{ALLOW:entries.filter((entry)=>entry.decision==="ALLOW").length},
      falseAlarms:entries.filter((entry)=>entry.findings&&entry.findings.length>0).length,
      whyCorrelation:"BUSINESS_OBJECT_HASH",
      persistedRecords:entries.length,
      sampleRecordId:entries[0]?.recordId??null,
    });
  }catch(error){
    console.error("[ThirdSight] Stage 7 flash-sale proof failed.",error);
    response.status(500).json({error:"FLASH_SALE_PROOF_FAILED",message:error instanceof Error?error.message:"Unknown failure"});
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
