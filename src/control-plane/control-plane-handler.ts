import { createHash, timingSafeEqual } from "node:crypto";
import type { PurposeContract } from "../domain/evidence-sources.js";
import { MerchantControlPlaneStore } from "./control-plane-store.js";

interface ApiRequest {
  method?:string;
  headers?:Record<string,string|string[]|undefined>;
  body?:unknown;
}

interface ApiResponse {
  status(code:number):ApiResponse;
  setHeader(name:string,value:string):void;
  json(body:unknown):void;
  end(body?:string):void;
}

type PresetId="cedar-analytics"|"cedar-delivery";
const MAX_CONTROL_PLANE_BODY_BYTES=16_384;

interface Preset {
  id:PresetId;
  integrationId:PresetId;
  displayName:string;
  environment:"synthetic-demo";
  purpose:string;
  resources:readonly string[];
  fields:readonly string[];
  validTriggers:readonly string[];
  summary:string;
}

export const SELF_SERVE_PRESETS:Readonly<Record<PresetId,Preset>>={
  "cedar-analytics":{
    id:"cedar-analytics",
    integrationId:"cedar-analytics",
    displayName:"CEDAR Analytics",
    environment:"synthetic-demo",
    purpose:"Measure product and purchase analytics",
    resources:["orders","products"],
    fields:["order.id","order.value","product.id","product.category","product.price"],
    validTriggers:["checkout.completed"],
    summary:"Commerce measurement only. customer.phone is not approved and is constrained before transmission.",
  },
  "cedar-delivery":{
    id:"cedar-delivery",
    integrationId:"cedar-delivery",
    displayName:"CEDAR Delivery",
    environment:"synthetic-demo",
    purpose:"Fulfil the confirmed customer order",
    resources:["orders","deliveries"],
    fields:["order.id","customer.phone","delivery.address","delivery.city","delivery.state","items[].sku","items[].quantity"],
    validTriggers:["order.ready_for_fulfilment"],
    summary:"Fulfilment scope. customer.phone is approved because delivery requires customer contact information.",
  },
};

class InputError extends Error {}

export default async function handler(request:ApiRequest,response:ApiResponse):Promise<void>{
  response.setHeader("Cache-Control","no-store");
  if(request.method==="OPTIONS"){response.status(204).end();return;}
  if(request.method!=="GET"&&request.method!=="POST"){
    response.status(405).json({error:"METHOD_NOT_ALLOWED"});
    return;
  }

  const env=runtimeEnv();
  const operatorKey=env.THIRDSIGHT_CONTROL_PLANE_OPERATOR_KEY?.trim();
  if(!operatorKey||operatorKey.length<16){
    response.status(503).json({error:"CONTROL_PLANE_NOT_CONFIGURED"});
    return;
  }
  if(!authorizedBearer(header(request,"authorization"),operatorKey)){
    response.status(401).json({error:"UNAUTHORIZED"});
    return;
  }

  const projectUrl=env.THIRDSIGHT_SUPABASE_URL?.trim();
  const serviceRoleKey=env.THIRDSIGHT_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!projectUrl||!serviceRoleKey){
    response.status(503).json({error:"CONTROL_PLANE_NOT_CONFIGURED"});
    return;
  }

  try{
    const store=new MerchantControlPlaneStore({projectUrl,serviceRoleKey});
    if(request.method==="GET"){
      const workspaces=await store.listWorkspaces();
      response.status(200).json({presets:Object.values(SELF_SERVE_PRESETS),workspaces});
      return;
    }

    if(bodyByteLength(request.body)>MAX_CONTROL_PLANE_BODY_BYTES){
      response.status(413).json({error:"PAYLOAD_TOO_LARGE"});
      return;
    }
    const input=parseProvisionInput(request.body);
    const workspace=await store.provisionWorkspace({name:input.workspaceName,slug:input.workspaceSlug});
    const preset=SELF_SERVE_PRESETS[input.presetId];
    const purposeContract=buildPurposeContract(preset,workspace.name,workspace.slug,new Date());
    const integration=await store.installIntegration({
      merchantId:workspace.merchantId,
      presetId:preset.id,
      integrationId:preset.integrationId,
      environment:preset.environment,
      purposeContract,
    });
    const key=await store.createApiKey({merchantId:workspace.merchantId,label:`${preset.displayName} managed gateway`});
    response.status(201).json({
      workspace,
      integration,
      apiKey:{
        value:key.rawKey,
        keyId:key.metadata.keyId,
        prefix:key.metadata.keyPrefix,
        lastFour:key.metadata.keyLastFour,
      },
    });
  }catch(error){
    if(error instanceof InputError){
      response.status(400).json({error:"INVALID_PROVISION_REQUEST",message:error.message});
      return;
    }
    // Never reflect database responses, service-role details, or internal exception text.
    response.status(503).json({error:"CONTROL_PLANE_UNAVAILABLE",message:"ThirdSight could not complete the control-plane request."});
  }
}

function parseProvisionInput(body:unknown):{workspaceName:string;workspaceSlug:string;presetId:PresetId}{
  const input=parseBody(body);
  if(!isRecord(input)) throw new InputError("Provisioning payload must be a JSON object.");
  const workspaceName=readString(input.workspaceName,"workspaceName",2,120);
  const workspaceSlug=readString(input.workspaceSlug,"workspaceSlug",3,64).toLowerCase();
  if(!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(workspaceSlug)){
    throw new InputError("workspaceSlug must use lowercase letters, numbers, and single hyphen-separated words.");
  }
  const presetValue=readString(input.presetId,"presetId",3,64);
  if(presetValue!=="cedar-analytics"&&presetValue!=="cedar-delivery"){
    throw new InputError("presetId must be cedar-analytics or cedar-delivery.");
  }
  return {workspaceName,workspaceSlug,presetId:presetValue};
}

function buildPurposeContract(preset:Preset,workspaceName:string,workspaceSlug:string,now:Date):PurposeContract{
  const validFrom=now.toISOString();
  const reviewAt=new Date(now.getTime()+90*24*60*60*1000).toISOString();
  return {
    contractId:`merchant-${workspaceSlug}-${preset.id}`,
    integrationId:preset.integrationId,
    version:"1",
    purpose:preset.purpose,
    resources:preset.resources,
    fields:preset.fields,
    operations:["send"],
    validTriggers:preset.validTriggers,
    environment:preset.environment,
    validFrom,
    reviewAt,
    expiresAt:null,
    owner:workspaceName,
    approvedBy:"Merchant operator via ThirdSight control plane",
    changeReason:`Installed approved ThirdSight preset ${preset.id}.`,
  };
}

function parseBody(body:unknown):unknown{
  if(typeof body!=="string") return body;
  try{return JSON.parse(body) as unknown}catch{throw new InputError("Request body is not valid JSON.");}
}

function bodyByteLength(body:unknown):number{
  try{
    const value=typeof body==="string"?body:JSON.stringify(body??null);
    return new TextEncoder().encode(value).byteLength;
  }catch{
    return Number.POSITIVE_INFINITY;
  }
}

function readString(value:unknown,label:string,min:number,max:number):string{
  if(typeof value!=="string") throw new InputError(`${label} must be a string.`);
  const trimmed=value.trim();
  if(trimmed.length<min||trimmed.length>max) throw new InputError(`${label} must be between ${min} and ${max} characters.`);
  return trimmed;
}

function authorizedBearer(value:string,expected:string):boolean{
  if(!value.startsWith("Bearer ")) return false;
  const provided=value.slice(7).trim();
  if(!provided) return false;
  const left=createHash("sha256").update(provided).digest();
  const right=createHash("sha256").update(expected).digest();
  return left.length===right.length&&timingSafeEqual(left,right);
}

function header(request:ApiRequest,name:string):string{
  const target=name.toLowerCase();
  for(const [key,value] of Object.entries(request.headers??{})){
    if(key.toLowerCase()!==target) continue;
    return typeof value==="string"?value:Array.isArray(value)?value[0]??"":"";
  }
  return "";
}

function isRecord(value:unknown):value is Record<string,unknown>{
  return typeof value==="object"&&value!==null&&!Array.isArray(value);
}

function runtimeEnv():Record<string,string|undefined>{
  const runtime=globalThis as typeof globalThis&{process?:{env?:Record<string,string|undefined>}};
  return runtime.process?.env??{};
}
