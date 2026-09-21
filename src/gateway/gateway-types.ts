import type { ManagedRequestContext } from "../managed/types.js";
import type { EvidenceHistoryStore } from "../infrastructure/evidence-history/evidence-history-store.js";

export type FailureMode="CLOSED"|"ALLOW_AND_AUDIT";
export type UnsupportedPayloadMode="BLOCK"|"OBSERVE";
export type CredentialSpec=
  |{kind:"NONE"}
  |{kind:"BEARER";env:string}
  |{kind:"HEADER";env:string;header:string;prefix?:string}
  |{kind:"API_KEY_HEADER";env:string;header:string}
  |{kind:"BODY_FIELD";env:string;field:string}
  |{kind:"QUERY_PARAM";env:string;param:string};

export interface AllowedRoute {
  method:string;
  path:string;
  allowedQueryKeys?:readonly string[];
}

export interface GatewayIntegration {
  id:string;
  name:string;
  environment:string;
  upstreamOrigin:string|null;
  upstreamOriginEnv?:string;
  allowedRoutes:readonly AllowedRoute[];
  allowedContentTypes:readonly string[];
  auth:CredentialSpec;
  failureMode:FailureMode;
  unsupportedPayloadMode:UnsupportedPayloadMode;
  timeoutMs:number;
  maxBodyBytes:number;
  compatibilityStatus:"LIVE_SANDBOX"|"CONTROLLED_RECEIVER"|"SCHEMA_COMPATIBLE";
  documentationUrl:string;
}

export interface GatewayRequest {
  requestId:string;
  integrationId:string;
  environment?:string;
  method:string;
  path:string;
  contentType:string;
  headers:Record<string,string>;
  body:unknown;
  context?:ManagedRequestContext;
  observedAt?:string;
}

export interface GatewayExecutionResult {
  requestId:string;
  integrationId:string;
  decision:"ALLOW"|"OBSERVE"|"CONSTRAIN"|"ISOLATE";
  outcome:"PREVENTED"|null;
  removedFields:readonly string[];
  transmittedFields:readonly string[];
  findings:readonly {type:string;action:string;field?:string;reason?:string}[];
  upstreamContacted:boolean;
  upstreamStatus:number|null;
  responseStatus:number;
  responseHeaders:Record<string,string>;
  responseBody:string;
  evidencePersisted:boolean;
  degraded:boolean;
  blockReason:string|null;
}

export interface GatewayDependencies {
  store:EvidenceHistoryStore;
  fetchImpl?:typeof fetch;
  env?:Record<string,string|undefined>;
  resolveIntegration?:(integrationId:string,environment:string|undefined)=>GatewayIntegration|null;
  resolveAddresses?:(hostname:string)=>Promise<readonly string[]>;
}
