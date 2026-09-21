import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { CredentialUnavailableError } from "../src/gateway/credential-provider.js";
import { GatewayExecutionError, executeGatewayRequest } from "../src/gateway/gateway-core.js";
import { GatewaySecurityError } from "../src/gateway/security.js";
import { SupabaseEvidenceHistoryStore } from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";
import { parseManagedRequestContext } from "../src/managed/context.js";
import { ManagedPayloadError } from "../src/managed/payload-paths.js";

interface ApiRequest {
  method?:string;
  query?:Record<string,string|string[]|undefined>;
  headers?:Record<string,string|string[]|undefined>;
  body?:unknown;
}
interface ApiResponse {
  status(code:number):ApiResponse;
  setHeader(name:string,value:string):void;
  json(body:unknown):void;
  end(body?:string):void;
}

export default async function handler(request:ApiRequest,response:ApiResponse):Promise<void>{
  response.setHeader("Cache-Control","no-store");
  if(!request.method){response.status(400).json({error:"METHOD_REQUIRED"});return;}
  if(request.method==="OPTIONS"){response.status(204).end();return;}

  const env=runtimeEnv();
  const gatewayKey=env.THIRDSIGHT_GATEWAY_API_KEY?.trim();
  if(!gatewayKey||gatewayKey.length<16){response.status(503).json({error:"GATEWAY_NOT_CONFIGURED"});return;}
  if(!authorizedBearer(header(request,"authorization"),gatewayKey)){
    response.status(401).json({error:"UNAUTHORIZED"});
    return;
  }

  const supabaseUrl=env.THIRDSIGHT_SUPABASE_URL?.trim();
  const serviceRoleKey=env.THIRDSIGHT_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if(!supabaseUrl||!serviceRoleKey){response.status(503).json({error:"PERSISTENCE_NOT_CONFIGURED"});return;}

  const integration=queryValue(request,"integration");
  const path=queryValue(request,"path");
  const environment=queryValue(request,"environment")||undefined;
  if(!integration||!path){
    response.status(400).json({error:"INTEGRATION_AND_PATH_REQUIRED"});
    return;
  }

  const requestId=randomUUID();
  response.setHeader("x-thirdsight-request-id",requestId);

  try{
    const store=new SupabaseEvidenceHistoryStore({projectUrl:supabaseUrl,serviceRoleKey});
    const context=parseContextHeader(header(request,"x-thirdsight-context"));
    const result=await executeGatewayRequest({
      requestId,
      integrationId:integration,
      environment,
      method:request.method,
      path,
      contentType:header(request,"content-type")||"application/json",
      headers:flattenHeaders(request.headers??{}),
      body:request.body,
      context,
    },{store,env});

    response.setHeader("x-thirdsight-decision",result.decision);
    response.setHeader("x-thirdsight-evidence",result.evidencePersisted?"persisted":"unavailable");
    if(result.degraded) response.setHeader("x-thirdsight-degraded","true");
    for(const [name,value] of Object.entries(result.responseHeaders)) response.setHeader(name,value);
    response.status(result.responseStatus).end(result.responseBody);
  }catch(error){
    const mapped=mapError(error);
    response.status(mapped.status).json({error:mapped.code,message:mapped.message,requestId});
  }
}

function parseContextHeader(value:string){
  if(!value) return undefined;
  if(value.length>4096) throw new ManagedPayloadError("Managed request context is too large.");
  let parsed:unknown;
  try{parsed=JSON.parse(value)}catch{throw new ManagedPayloadError("Managed request context is not valid JSON.");}
  return parseManagedRequestContext(parsed);
}

function authorizedBearer(value:string,expected:string):boolean{
  const prefix="Bearer ";
  if(!value.startsWith(prefix)) return false;
  const provided=value.slice(prefix.length).trim();
  if(!provided) return false;
  const left=createHash("sha256").update(provided).digest();
  const right=createHash("sha256").update(expected).digest();
  return timingSafeEqual(left,right);
}

function flattenHeaders(input:Record<string,string|string[]|undefined>):Record<string,string>{
  const output:Record<string,string>={};
  for(const [name,value] of Object.entries(input)){
    if(typeof value==="string") output[name]=value;
    else if(Array.isArray(value)) output[name]=value.join(", ");
  }
  return output;
}

function queryValue(request:ApiRequest,key:string):string{
  const value=request.query?.[key];
  return typeof value==="string"?value:Array.isArray(value)?value[0]??"":"";
}

function header(request:ApiRequest,name:string):string{
  const target=name.toLowerCase();
  for(const [key,value] of Object.entries(request.headers??{})){
    if(key.toLowerCase()!==target) continue;
    return typeof value==="string"?value:Array.isArray(value)?value[0]??"":"";
  }
  return "";
}

function mapError(error:unknown):{status:number;code:string;message:string}{
  if(error instanceof GatewayExecutionError){
    const message=error.code==="UPSTREAM_UNAVAILABLE"
      ?"The registered upstream could not be reached."
      :error.message;
    return {status:error.status,code:error.code,message};
  }
  if(error instanceof GatewaySecurityError) return {status:400,code:"GATEWAY_POLICY_REJECTED",message:error.message};
  if(error instanceof ManagedPayloadError) return {status:400,code:"INVALID_PAYLOAD",message:error.message};
  if(error instanceof CredentialUnavailableError) return {status:503,code:"UPSTREAM_CREDENTIAL_UNAVAILABLE",message:"The registered upstream credential is unavailable."};
  return {status:500,code:"GATEWAY_FAILED",message:"ThirdSight could not complete the managed request."};
}

function runtimeEnv():Record<string,string|undefined>{
  const runtime=globalThis as typeof globalThis & {process?:{env?:Record<string,string|undefined>}};
  return runtime.process?.env??{};
}
