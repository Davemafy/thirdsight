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
const APPROVED_FIELDS=["product.id","product.category","product.price"] as const;
const TOTAL=100;
const ABUSE=10;

export default async function handler(request:ApiRequest,response:ApiResponse):Promise<void>{
  response.setHeader("Cache-Control","no-store");
  if(request.method!=="POST"){response.status(405).json({error:"METHOD_NOT_ALLOWED"});return;}
  const token=readBearer(request);
  if(!token||!(await verifyGitHubActionsOidc(token,"thirdsight-stage7-proportional",".github/workflows/stage7-proportional.yml"))){
    response.status(401).json({error:"UNAUTHORIZED"});return;
  }
  const cfg=readConfig();
  if(!cfg){response.status(503).json({error:"PERSISTENCE_NOT_CONFIGURED"});return;}

  try{
    const store=new SupabaseEvidenceHistoryStore({projectUrl:cfg.supabaseUrl,serviceRoleKey:cfg.serviceRoleKey});
    const base=Date.now();
    const events=Array.from({length:TOTAL},(_,index)=>businessEventEvidence({
      id:`gate5-proportional-business-${index}`,
      type:"product.viewed",
      timestamp:new Date(base+index*50).toISOString(),
      orderRefHash:`gate5-proportional-order-${index}`,
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
    for(let index=0;index<TOTAL;index+=1){
      const timestamp=events[index].event.timestamp;
      const mismatched=index>=TOTAL-ABUSE;
      const orderRefHash=mismatched?`gate5-unrelated-order-${index}`:`gate5-proportional-order-${index}`;
      const observation={
        schemaVersion:"browser-observation.v1" as const,
        observationId:`gate5-proportional-${index}`,
        sensorId:"commerce-lab:proportional",
        observedAt:timestamp,
        pageUrl:`https://commerce-lab.example/products/sku-${index}`,
        destinationUrl:DESTINATION,
        method:"POST",
        resourceType:"Fetch",
        initiatorType:"script",
        hasPostData:true,
        businessObjectRefs:{orderRefHash},
      };
      const baseEvidence=ingestBrowserObservation(observation,timestamp);
      const resolved=resolveIntegrationIdentity(baseEvidence.evidence,bindings,ENVIRONMENT);
      if(!resolved.evidence.integrationId) throw new Error("Proportional scenario integration identity did not resolve.");

      const evidence=enrichEvidenceGraph(resolved.evidence,{purposeContracts:contracts,capabilities,businessEvents:events});
      const findings=verifyObservedFields(evidence,APPROVED_FIELDS,contracts);
      const decision=decideVerification(findings);
      const mismatchFindings=findings.filter((finding)=>finding.type==="PURPOSE_MISMATCH");

      if(mismatched){
        if(mismatchFindings.length!==1||decision!=="CONSTRAIN"||evidence.why.status!=="UNKNOWN"){
          throw new Error(`Abusive request ${index} was not caught by object-level purpose verification.`);
        }
      }else if(findings.length!==0||decision!=="ALLOW"||evidence.why.value?.correlationStrength!=="BUSINESS_OBJECT_HASH"){
        throw new Error(`Legitimate sale request ${index} was disrupted.`);
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
    const purposeMismatch=entries.filter((entry)=>entry.findings?.some((finding)=>finding.type==="PURPOSE_MISMATCH"));
    response.status(200).json({
      ok:true,
      scenario:"proportional-exfiltration-hidden-in-sale",
      businessEvents:TOTAL,
      browserRequests:TOTAL,
      rawRequestToBusinessEventRatio:TOTAL/TOTAL,
      legitimateRequests:TOTAL-ABUSE,
      abusiveRequests:ABUSE,
      decisions:{
        ALLOW:entries.filter((entry)=>entry.decision==="ALLOW").length,
        CONSTRAIN:entries.filter((entry)=>entry.decision==="CONSTRAIN").length,
      },
      purposeMismatchFindings:purposeMismatch.length,
      persistedRecords:entries.length,
      sampleAbuseRecordId:purposeMismatch[0]?.recordId??null,
    });
  }catch(error){
    console.error("[ThirdSight] Stage 7 proportional proof failed.",error);
    response.status(500).json({error:"PROPORTIONAL_PROOF_FAILED",message:error instanceof Error?error.message:"Unknown failure"});
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
