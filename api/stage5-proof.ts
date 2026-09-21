import { businessEventEvidence } from "../src/domain/evidence-sources.js";
import { verifyObservedFields } from "../src/domain/deterministic-verifier.js";
import { ingestAndPersistBrowserObservation } from "../src/infrastructure/browser-evidence/browser-observation-pipeline.js";
import { SupabaseEvidenceHistoryStore } from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";
import type { EvidenceHistoryEntry } from "../src/infrastructure/evidence-history/evidence-history-store.js";
import { buildManagedHistoryEntry, enforceManagedRequest } from "../src/managed/managed-request.js";

interface ApiRequest { method?: string }
interface ApiResponse { status(code:number):ApiResponse; setHeader(name:string,value:string):void; json(body:unknown):void; end():void }

const INTEGRATION_ID="analytics-partner";
const ENVIRONMENT="production";

export default async function handler(request:ApiRequest,response:ApiResponse):Promise<void>{
  response.setHeader("Cache-Control","no-store");
  if(request.method!=="GET"){response.status(405).json({error:"METHOD_NOT_ALLOWED"});return;}
  const cfg=readConfig();
  if(!cfg){response.status(503).json({error:"PERSISTENCE_NOT_CONFIGURED"});return;}
  try{
    const store=new SupabaseEvidenceHistoryStore({projectUrl:cfg.supabaseUrl,serviceRoleKey:cfg.serviceRoleKey});
    const receiverUrl=new URL("/functions/v1/thirdsight-analytics-receiver",cfg.supabaseUrl).toString();
    const base=Date.now();

    const managed=await runManagedProof(store,receiverUrl,new Date(base).toISOString(),new Date(base+1000).toISOString());
    const passive=await runPassiveProof(store,receiverUrl,new Date(base+2000).toISOString(),new Date(base+3000).toISOString());

    response.status(200).json({ok:true,managed,passive});
  }catch(error){
    console.error("[ThirdSight] Stage 5 proof failed.",error);
    response.status(500).json({error:"STAGE5_PROOF_FAILED",message:error instanceof Error?error.message:"Unknown failure"});
  }
}

async function runManagedProof(
  store:SupabaseEvidenceHistoryStore,
  receiverUrl:string,
  eventAt:string,
  observedAt:string,
){
  const destination=new URL(receiverUrl);
  const result=await enforceManagedRequest({
    requestId:"stage5-managed-proof-"+Date.now(),
    integrationId:INTEGRATION_ID,
    environment:ENVIRONMENT,
    destinationOrigin:destination.origin,
    destinationPath:destination.pathname,
    method:"POST",
    payload:{
      "product.id":"sku-stage5",
      "product.category":"phones",
      "product.price":120000,
      "customer.phone":"synthetic:+234000000000",
    },
    observedAt,
    context:{
      businessEvent:{
        id:"stage5-managed-product-view-"+Date.now(),
        type:"product.viewed",
        timestamp:eventAt,
      },
    },
    store,
  });

  if(result.outcome!=="PREVENTED"||result.decision!=="CONSTRAIN"){
    throw new Error("Managed proof did not produce deterministic CONSTRAIN/PREVENTED.");
  }
  const receiver=await sendToReceiver(receiverUrl,result.payload);
  if(receiver.forbiddenFieldReceived) throw new Error("Receiver obtained customer.phone after inline constraint.");

  const entry=buildManagedHistoryEntry({
    result,
    environment:ENVIRONMENT,
    acceptedAt:new Date().toISOString(),
    upstreamContacted:true,
    upstreamStatus:receiver.status,
    transmissionKnown:true,
    receiver:{
      receivedFields:receiver.receivedFields,
      forbiddenFieldReceived:receiver.forbiddenFieldReceived,
    },
  });
  await store.append(entry);

  return {
    recordId:entry.recordId,
    outcome:entry.outcome,
    decision:entry.decision,
    should:entry.evidence.should,
    could:entry.evidence.could,
    did:entry.evidence.did,
    why:entry.evidence.why,
    findings:entry.findings,
    enforcement:entry.enforcement,
  };
}

async function runPassiveProof(
  store:SupabaseEvidenceHistoryStore,
  receiverUrl:string,
  eventAt:string,
  observedAt:string,
){
  const event=businessEventEvidence({id:"stage5-passive-product-view",type:"product.viewed",timestamp:eventAt,integrationId:INTEGRATION_ID});
  await store.appendBusinessEvent(event);
  const observation=browserObservation("commerce-lab:passive-browser","stage5-passive-proof",observedAt,receiverUrl);
  const initial=await ingestAndPersistBrowserObservation(observation,store,ENVIRONMENT,observedAt);
  if(!initial.evidence.integrationId) throw new Error("Passive proof integration identity did not resolve.");

  const payload={"product.id":"sku-stage5","product.category":"phones","product.price":120000,"customer.phone":"synthetic:+234000000000"};
  const receiver=await sendToReceiver(receiverUrl,payload);
  if(!receiver.forbiddenFieldReceived) throw new Error("Passive proof receiver did not receive the test field.");

  const evidence=withTransmittedData(initial.evidence,Object.keys(payload));
  const contracts=await store.findPurposeContracts(initial.evidence.integrationId,ENVIRONMENT,observedAt);
  const findings=verifyObservedFields(evidence,Object.keys(payload),contracts);
  const entry:EvidenceHistoryEntry={
    recordId:evidence.recordId,observationId:initial.observation.observationId,acceptedAt:initial.acceptedAt,
    observation:initial.observation,evidence,integrationResolution:initial.integrationResolution,
    findings,enforcement:null,outcome:"DETECTED"
  };
  await store.append(entry);
  return {recordId:entry.recordId,outcome:entry.outcome,should:evidence.should,could:evidence.could,did:evidence.did,why:evidence.why,findings,receiver};
}

function browserObservation(sensorId:string,observationId:string,observedAt:string,destinationUrl:string){
  return {schemaVersion:"browser-observation.v1",observationId,sensorId,observedAt,pageUrl:"https://commerce-lab.example/products/sku-stage5",destinationUrl,method:"POST",resourceType:"Fetch",initiatorType:"script",hasPostData:true} as const;
}

function withTransmittedData(evidence:Awaited<ReturnType<typeof ingestAndPersistBrowserObservation>>["evidence"],fields:readonly string[]){
  if(!evidence.did.value) return evidence;
  return {...evidence,did:{...evidence.did,value:{...evidence.did.value,phase:"TRANSMITTED" as const,dataCategories:fields},reason:"Receiver acknowledgement proves this controlled payload was transmitted."}};
}

async function sendToReceiver(
  receiverUrl:string,
  payload:Record<string,unknown>,
):Promise<{receivedFields:string[];forbiddenFieldReceived:boolean;status:number}>{
  const response=await fetch(receiverUrl,{method:"POST",headers:{"content-type":"application/json","x-thirdsight-demo":"stage5-proof-v1"},body:JSON.stringify(payload),cache:"no-store"});
  if(!response.ok) throw new Error(`Analytics receiver failed with ${response.status}.`);
  const body=await response.json() as {receivedFields?:unknown;forbiddenFieldReceived?:unknown};
  if(!Array.isArray(body.receivedFields)||body.receivedFields.some(x=>typeof x!=="string")||typeof body.forbiddenFieldReceived!=="boolean") throw new Error("Analytics receiver returned invalid proof.");
  return {receivedFields:body.receivedFields as string[],forbiddenFieldReceived:body.forbiddenFieldReceived,status:response.status};
}

function readConfig(){
  const runtime=globalThis as typeof globalThis & {process?:{env?:Record<string,string|undefined>}};
  const supabaseUrl=runtime.process?.env?.THIRDSIGHT_SUPABASE_URL?.trim();
  const serviceRoleKey=runtime.process?.env?.THIRDSIGHT_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!supabaseUrl||!serviceRoleKey) return null;
  return {supabaseUrl,serviceRoleKey};
}
