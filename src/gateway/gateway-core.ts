import { lookup } from "node:dns/promises";
import { businessEventEvidence } from "../domain/evidence-sources.js";
import type { EvidenceClaim, EvidenceGraphRecord } from "../domain/evidence.js";
import { enrichEvidenceGraph } from "../domain/evidence-verification.js";
import type { EvidenceHistoryEntry } from "../infrastructure/evidence-history/evidence-history-store.js";
import type { ManagedHttpObservationV1 } from "../infrastructure/gateway/managed-http-observation.js";
import { buildManagedHistoryEntry, enforceManagedRequest } from "../managed/managed-request.js";
import { flattenJsonObject, parseJsonBody, type JsonObject } from "../managed/payload-paths.js";
import { applyCredential, CredentialUnavailableError } from "./credential-provider.js";
import { resolveGatewayIntegration } from "./integration-registry.js";
import { forwardOpaqueRequest, forwardRegisteredRequest } from "./request-forwarder.js";
import { assertResolvedAddressesPublic, filterClientHeaders, resolveSafeUpstream, safeResponseHeaders } from "./security.js";
import type { GatewayDependencies, GatewayExecutionResult, GatewayIntegration, GatewayRequest } from "./gateway-types.js";

export class GatewayExecutionError extends Error {
  readonly status:number;
  readonly code:string;
  constructor(status:number,code:string,message:string){
    super(message);
    this.name="GatewayExecutionError";
    this.status=status;
    this.code=code;
  }
}

export async function executeGatewayRequest(
  request:GatewayRequest,
  dependencies:GatewayDependencies,
):Promise<GatewayExecutionResult>{
  const observedAt=request.observedAt??new Date().toISOString();
  const env=dependencies.env??runtimeEnv();
  const integration=(dependencies.resolveIntegration
    ?dependencies.resolveIntegration(request.integrationId,request.environment)
    :resolveGatewayIntegration(request.integrationId,request.environment,env));
  if(!integration) throw new GatewayExecutionError(404,"INTEGRATION_NOT_REGISTERED","Integration is not registered for the requested environment.");

  const {url}=resolveSafeUpstream(integration,request.path,request.method);
  await assertPublicResolution(url.hostname,dependencies);
  const contentType=normalizeContentType(request.contentType);

  if(!integration.allowedContentTypes.includes(contentType)){
    if(integration.unsupportedPayloadMode==="BLOCK"){
      throw new GatewayExecutionError(415,"UNSUPPORTED_CONTENT_TYPE","This integration blocks payload types ThirdSight cannot inspect safely.");
    }
    return executeOpaqueObserve(request,integration,url,dependencies,env,observedAt);
  }

  const body=parseJsonBody(request.body);
  assertBodySize(body,integration.maxBodyBytes);
  const fetchImpl=dependencies.fetchImpl??fetch;

  let managed;
  try{
    managed=await enforceManagedRequest({
      requestId:request.requestId,
      integrationId:integration.id,
      environment:integration.environment,
      destinationOrigin:url.origin,
      destinationPath:url.pathname,
      method:request.method,
      payload:body,
      observedAt,
      context:request.context,
      store:dependencies.store,
    });
  }catch(error){
    if(integration.failureMode==="CLOSED"){
      throw new GatewayExecutionError(503,"POLICY_UNAVAILABLE","ThirdSight could not establish the managed policy decision.");
    }
    return forwardDegraded({request,integration,body,url,dependencies,env,error});
  }

  if(!managed.shouldForward){
    const entry=buildManagedHistoryEntry({
      result:managed,
      environment:integration.environment,
      acceptedAt:new Date().toISOString(),
      upstreamContacted:false,
      upstreamStatus:null,
      transmissionKnown:true,
    });
    const persisted=await appendBestEffort(dependencies,entry);
    return {
      requestId:request.requestId,
      integrationId:integration.id,
      decision:managed.decision,
      outcome:managed.outcome,
      removedFields:managed.removedFields,
      transmittedFields:[],
      findings:managed.findings,
      upstreamContacted:false,
      upstreamStatus:null,
      responseStatus:managed.decision==="ISOLATE"?403:409,
      responseHeaders:{"content-type":"application/json"},
      responseBody:JSON.stringify({
        error:managed.decision==="ISOLATE"?"INTEGRATION_ISOLATED":"PURPOSE_MISMATCH",
        message:managed.blockReason,
        requestId:request.requestId,
      }),
      evidencePersisted:persisted,
      degraded:false,
      blockReason:managed.blockReason,
    };
  }

  const filtered=filterClientHeaders(request.headers);
  filtered.set("x-thirdsight-request-id",request.requestId);
  let credential;
  try{
    credential=applyCredential({spec:integration.auth,env,url,headers:filtered,body:managed.payload});
  }catch(error){
    const entry=buildManagedHistoryEntry({
      result:managed,
      environment:integration.environment,
      acceptedAt:new Date().toISOString(),
      upstreamContacted:false,
      upstreamStatus:null,
      transmissionKnown:true,
    });
    await appendBestEffort(dependencies,entry);
    if(error instanceof CredentialUnavailableError) throw error;
    throw new GatewayExecutionError(503,"UPSTREAM_CREDENTIAL_UNAVAILABLE","The registered upstream credential could not be applied.");
  }

  let upstream:Response;
  try{
    upstream=await forwardRegisteredRequest({
      url:credential.url,
      method:request.method,
      headers:credential.headers,
      body:credential.body,
      timeoutMs:integration.timeoutMs,
      fetchImpl,
    });
  }catch(error){
    const entry=buildManagedHistoryEntry({
      result:managed,
      environment:integration.environment,
      acceptedAt:new Date().toISOString(),
      upstreamContacted:null,
      upstreamStatus:null,
      transmissionKnown:false,
    });
    await appendBestEffort(dependencies,entry);
    throw new GatewayExecutionError(
      502,
      "UPSTREAM_UNAVAILABLE",
      error instanceof Error?error.message:"The registered upstream request failed.",
    );
  }

  const responseBody=await readBoundedText(upstream,2_000_000);
  const entry=buildManagedHistoryEntry({
    result:managed,
    environment:integration.environment,
    acceptedAt:new Date().toISOString(),
    upstreamContacted:true,
    upstreamStatus:upstream.status,
    transmissionKnown:true,
  });
  const persisted=await appendBestEffort(dependencies,entry);

  return {
    requestId:request.requestId,
    integrationId:integration.id,
    decision:managed.decision,
    outcome:managed.outcome,
    removedFields:managed.removedFields,
    transmittedFields:Object.keys(flattenJsonObject(managed.payload)).sort(),
    findings:managed.findings,
    upstreamContacted:true,
    upstreamStatus:upstream.status,
    responseStatus:upstream.status,
    responseHeaders:safeResponseHeaders(upstream.headers),
    responseBody,
    evidencePersisted:persisted,
    degraded:false,
    blockReason:null,
  };
}

async function executeOpaqueObserve(
  request:GatewayRequest,
  integration:GatewayIntegration,
  url:URL,
  dependencies:GatewayDependencies,
  env:Record<string,string|undefined>,
  observedAt:string,
):Promise<GatewayExecutionResult>{
  if(integration.auth.kind==="BODY_FIELD"){
    throw new GatewayExecutionError(415,"OPAQUE_BODY_CREDENTIAL_UNSUPPORTED","This integration cannot inject a body credential while the payload is opaque.");
  }
  const method=request.method.toUpperCase();
  const rawBody=method==="GET"||method==="HEAD"?undefined:opaqueBody(request.body);
  if(rawBody!==undefined&&new TextEncoder().encode(rawBody).byteLength>integration.maxBodyBytes){
    throw new GatewayExecutionError(413,"PAYLOAD_TOO_LARGE","Opaque managed request exceeds this integration's configured body limit.");
  }

  const filtered=filterClientHeaders(request.headers);
  filtered.set("x-thirdsight-request-id",request.requestId);
  const credential=applyCredential({spec:integration.auth,env,url,headers:filtered,body:{}});
  const fetchImpl=dependencies.fetchImpl??fetch;

  let upstream:Response;
  try{
    upstream=await forwardOpaqueRequest({
      url:credential.url,
      method,
      headers:credential.headers,
      body:rawBody,
      timeoutMs:integration.timeoutMs,
      fetchImpl,
    });
  }catch(error){
    const entry=await buildOpaqueHistoryEntry(request,integration,url,dependencies,observedAt,null,null);
    await appendBestEffort(dependencies,entry);
    throw new GatewayExecutionError(502,"UPSTREAM_UNAVAILABLE",error instanceof Error?error.message:"The registered upstream request failed.");
  }

  const responseBody=await readBoundedText(upstream,2_000_000);
  const entry=await buildOpaqueHistoryEntry(request,integration,url,dependencies,observedAt,true,upstream.status);
  const persisted=await appendBestEffort(dependencies,entry);
  return {
    requestId:request.requestId,
    integrationId:integration.id,
    decision:"OBSERVE",
    outcome:null,
    removedFields:[],
    transmittedFields:[],
    findings:[],
    upstreamContacted:true,
    upstreamStatus:upstream.status,
    responseStatus:upstream.status,
    responseHeaders:safeResponseHeaders(upstream.headers),
    responseBody,
    evidencePersisted:persisted,
    degraded:false,
    blockReason:"Payload semantics were opaque, so ThirdSight observed the registered route without claiming field-level enforcement.",
  };
}

async function forwardDegraded(input:{
  request:GatewayRequest;
  integration:GatewayIntegration;
  body:JsonObject;
  url:URL;
  dependencies:GatewayDependencies;
  env:Record<string,string|undefined>;
  error:unknown;
}):Promise<GatewayExecutionResult>{
  const filtered=filterClientHeaders(input.request.headers);
  filtered.set("x-thirdsight-request-id",input.request.requestId);
  const credential=applyCredential({spec:input.integration.auth,env:input.env,url:input.url,headers:filtered,body:input.body});
  const fetchImpl=input.dependencies.fetchImpl??fetch;
  let upstream:Response;
  try{
    upstream=await forwardRegisteredRequest({
      url:credential.url,
      method:input.request.method,
      headers:credential.headers,
      body:credential.body,
      timeoutMs:input.integration.timeoutMs,
      fetchImpl,
    });
  }catch(error){
    throw new GatewayExecutionError(502,"UPSTREAM_UNAVAILABLE",error instanceof Error?error.message:"The registered upstream request failed.");
  }

  const responseBody=await readBoundedText(upstream,2_000_000);
  const degradedEntry=await buildOpaqueHistoryEntry(
    input.request,
    input.integration,
    input.url,
    input.dependencies,
    input.request.observedAt??new Date().toISOString(),
    true,
    upstream.status,
  );
  const persisted=await appendBestEffort(input.dependencies,degradedEntry);
  return {
    requestId:input.request.requestId,
    integrationId:input.integration.id,
    decision:"OBSERVE",
    outcome:null,
    removedFields:[],
    transmittedFields:Object.keys(flattenJsonObject(input.body)).sort(),
    findings:[],
    upstreamContacted:true,
    upstreamStatus:upstream.status,
    responseStatus:upstream.status,
    responseHeaders:safeResponseHeaders(upstream.headers),
    responseBody,
    evidencePersisted:persisted,
    degraded:true,
    blockReason:input.error instanceof Error?input.error.message:"Policy evaluation unavailable.",
  };
}

async function buildOpaqueHistoryEntry(
  request:GatewayRequest,
  integration:GatewayIntegration,
  url:URL,
  dependencies:GatewayDependencies,
  observedAt:string,
  upstreamContacted:boolean|null,
  upstreamStatus:number|null,
):Promise<EvidenceHistoryEntry>{
  if(request.context?.businessEvent){
    const event=request.context.businessEvent;
    try{
      await dependencies.store.appendBusinessEvent(businessEventEvidence({
        id:event.id,
        type:event.type,
        timestamp:event.timestamp??observedAt,
        integrationId:integration.id,
        ...(event.customerRefHash?{customerRefHash:event.customerRefHash}:{}),
        ...(event.orderRefHash?{orderRefHash:event.orderRefHash}:{}),
        ...(event.paymentRefHash?{paymentRefHash:event.paymentRefHash}:{}),
        ...(event.deliveryRefHash?{deliveryRefHash:event.deliveryRefHash}:{}),
        ...(event.campaignRef?{campaignRef:event.campaignRef}:{}),
      }));
    }catch{
      // A degraded/opaque request must not report a client-side failure after an upstream may have processed it.
    }
  }

  const unknown=<T>(reason:string):EvidenceClaim<T>=>({status:"UNKNOWN",confidence:"UNKNOWN",value:null,provenance:[],reason});
  const provenance=[{source:"gateway" as const,sourceId:request.requestId,observedAt,confidence:"OBSERVED" as const}];
  let evidence:EvidenceGraphRecord={
    recordId:"gateway-http:"+request.requestId,
    observedAt,
    integrationId:integration.id,
    integrationResolution:"RESOLVED",
    should:unknown("Purpose Contract has not yet been projected for this opaque managed request."),
    could:unknown("No complete capability surface is available from this opaque managed request."),
    did:{
      status:"KNOWN",
      confidence:"OBSERVED",
      value:{
        boundary:"gateway",
        phase:upstreamContacted===true?"TRANSMITTED":"ATTEMPTED",
        pageOrigin:null,
        destinationOrigin:url.origin,
        destinationPath:url.pathname,
        method:request.method.toUpperCase(),
        resourceType:"HTTP",
        initiatorType:"thirdsight-sdk",
        hasPostData:request.method.toUpperCase()!=="GET"&&request.method.toUpperCase()!=="HEAD",
        originRelationship:"CROSS_ORIGIN",
        ...(request.context?.requestRefs?{businessObjectRefs:request.context.requestRefs}:{}),
      },
      provenance,
      reason:"ThirdSight observed the registered outbound route, but the payload format was opaque to field-level inspection.",
    },
    why:unknown("Trusted first-party context has not yet been projected for this opaque managed request."),
    coverage:{
      label:"MULTI_BOUNDARY",
      boundaries:["gateway"],
      limitations:["Payload semantics were opaque. No field-level allow or constrain claim is made for this request."],
    },
  };

  try{
    const [contracts,capabilities,businessEvents]=await Promise.all([
      dependencies.store.findPurposeContracts(integration.id,integration.environment,observedAt),
      dependencies.store.findCapabilities(integration.id,integration.environment,observedAt),
      dependencies.store.findBusinessEvents(integration.id,observedAt),
    ]);
    evidence=enrichEvidenceGraph(evidence,{purposeContracts:contracts,capabilities,businessEvents});
  }catch{
    // Observation remains valid even when enrichment is unavailable.
  }

  const observation:ManagedHttpObservationV1={
    schemaVersion:"managed-http.v1",
    observationId:request.requestId,
    observedAt,
    integrationId:integration.id,
    environment:integration.environment,
    destinationOrigin:url.origin,
    destinationPath:url.pathname,
    method:request.method.toUpperCase(),
    attemptedFields:[],
    transmittedFields:[],
    upstreamContacted,
    upstreamStatus,
  };

  return {
    recordId:evidence.recordId,
    observationId:request.requestId,
    acceptedAt:new Date().toISOString(),
    observation,
    evidence,
    integrationResolution:{
      status:"RESOLVED",
      integrationId:integration.id,
      confidence:"AUTHORITATIVE",
      bindingIds:[],
      sourceIds:["managed-gateway:"+integration.id],
      reason:"Resolved from the server-owned ThirdSight managed integration registry.",
    },
    findings:[],
    decision:"OBSERVE",
    outcome:null,
  };
}

async function appendBestEffort(dependencies:GatewayDependencies,entry:EvidenceHistoryEntry):Promise<boolean>{
  try{
    await dependencies.store.append(entry);
    return true;
  }catch{
    return false;
  }
}

function opaqueBody(value:unknown):string|undefined{
  if(value===undefined||value===null) return undefined;
  if(typeof value==="string") return value;
  throw new GatewayExecutionError(415,"OPAQUE_BODY_UNAVAILABLE","ThirdSight cannot safely reconstruct this opaque request body after framework parsing.");
}

function normalizeContentType(value:string):string{
  return value.split(";")[0]?.trim().toLowerCase()??"";
}

function assertBodySize(body:JsonObject,maxBytes:number):void{
  const bytes=new TextEncoder().encode(JSON.stringify(body)).byteLength;
  if(bytes>maxBytes) throw new GatewayExecutionError(413,"PAYLOAD_TOO_LARGE","Managed request exceeds this integration's configured body limit.");
}

async function readBoundedText(response:Response,maxBytes:number):Promise<string>{
  const length=response.headers.get("content-length");
  if(length&&Number(length)>maxBytes) throw new GatewayExecutionError(502,"UPSTREAM_RESPONSE_TOO_LARGE","Registered upstream response exceeded the gateway response limit.");
  if(!response.body) return "";
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let total=0;
  let text="";
  for(;;){
    const {done,value}=await reader.read();
    if(done) break;
    total+=value.byteLength;
    if(total>maxBytes){
      await reader.cancel().catch(()=>undefined);
      throw new GatewayExecutionError(502,"UPSTREAM_RESPONSE_TOO_LARGE","Registered upstream response exceeded the gateway response limit.");
    }
    text+=decoder.decode(value,{stream:true});
  }
  text+=decoder.decode();
  return text;
}

async function assertPublicResolution(hostname:string,dependencies:GatewayDependencies):Promise<void>{
  const addresses=dependencies.resolveAddresses
    ?await dependencies.resolveAddresses(hostname)
    :(await lookup(hostname,{all:true,verbatim:true})).map((entry)=>entry.address);
  assertResolvedAddressesPublic(addresses);
}

function runtimeEnv():Record<string,string|undefined>{
  const runtime=globalThis as typeof globalThis & {process?:{env?:Record<string,string|undefined>}};
  return runtime.process?.env??{};
}
