import { createHash, randomBytes } from "node:crypto";
import type { PurposeContract } from "../domain/evidence-sources.js";

export interface MerchantWorkspace {
  merchantId:string;
  name:string;
  slug:string;
  status:"ACTIVE"|"SUSPENDED";
  createdAt:string;
}

export interface MerchantIntegration {
  merchantIntegrationId:string;
  merchantId:string;
  presetId:"cedar-analytics"|"cedar-delivery";
  integrationId:string;
  environment:string;
  lifecycleStatus:"ACTIVE"|"RETIRED";
  purposeContract:PurposeContract;
  installedAt:string;
}

export interface MerchantKeyMetadata {
  keyId:string;
  merchantId:string;
  keyPrefix:string;
  keyLastFour:string;
  label:string;
  createdAt:string;
  lastUsedAt:string|null;
  revokedAt:string|null;
}

export interface MerchantWorkspaceSummary extends MerchantWorkspace {
  integrations:readonly MerchantIntegration[];
  apiKeys:readonly MerchantKeyMetadata[];
}

export interface AuthenticatedMerchantKey {
  merchantId:string;
  keyId:string;
}

interface Config {
  projectUrl:string;
  serviceRoleKey:string;
  fetchImpl?:typeof fetch;
}

interface WorkspaceRow {
  merchant_id:string;
  name:string;
  slug:string;
  status:"ACTIVE"|"SUSPENDED";
  created_at:string;
}

interface IntegrationRow {
  merchant_integration_id:string;
  merchant_id:string;
  preset_id:"cedar-analytics"|"cedar-delivery";
  integration_id:string;
  environment:string;
  lifecycle_status:"ACTIVE"|"RETIRED";
  purpose_contract:PurposeContract;
  installed_at:string;
}

interface KeyRow {
  key_id:string;
  merchant_id:string;
  key_prefix:string;
  key_last_four:string;
  label:string;
  created_at:string;
  last_used_at:string|null;
  revoked_at:string|null;
}

interface AuthRow {
  key_id:string;
  merchant_id:string;
  revoked_at:string|null;
  workspace:WorkspaceRow|WorkspaceRow[]|null;
}

export class ControlPlaneStoreError extends Error {
  constructor(message:string){
    super(message);
    this.name="ControlPlaneStoreError";
  }
}

export class MerchantControlPlaneStore {
  private readonly projectUrl:string;
  private readonly serviceRoleKey:string;
  private readonly fetchImpl:typeof fetch;

  constructor(config:Config){
    this.projectUrl=normalizeProjectUrl(config.projectUrl);
    this.serviceRoleKey=config.serviceRoleKey.trim();
    this.fetchImpl=config.fetchImpl??fetch;
    if(!this.serviceRoleKey) throw new ControlPlaneStoreError("Supabase service-role key is required.");
  }

  async provisionWorkspace(input:{name:string;slug:string}):Promise<MerchantWorkspace>{
    const url=this.restUrl("merchant_workspaces");
    const rows=await this.requestJson<WorkspaceRow[]>(url,{
      method:"POST",
      headers:{"content-type":"application/json",prefer:"return=representation"},
      body:JSON.stringify({name:input.name,slug:input.slug,status:"ACTIVE"}),
    });
    const row=rows[0];
    if(!row) throw new ControlPlaneStoreError("Workspace provisioning returned no row.");
    return mapWorkspace(row);
  }

  async installIntegration(input:{
    merchantId:string;
    presetId:"cedar-analytics"|"cedar-delivery";
    integrationId:string;
    environment:string;
    purposeContract:PurposeContract;
  }):Promise<MerchantIntegration>{
    const url=this.restUrl("merchant_integrations");
    url.searchParams.set("on_conflict","merchant_id,integration_id");
    const rows=await this.requestJson<IntegrationRow[]>(url,{
      method:"POST",
      headers:{"content-type":"application/json",prefer:"resolution=merge-duplicates,return=representation"},
      body:JSON.stringify({
        merchant_id:input.merchantId,
        preset_id:input.presetId,
        integration_id:input.integrationId,
        environment:input.environment,
        lifecycle_status:"ACTIVE",
        purpose_contract:input.purposeContract,
      }),
    });
    const row=rows[0];
    if(!row) throw new ControlPlaneStoreError("Integration installation returned no row.");
    return mapIntegration(row);
  }

  async createApiKey(input:{merchantId:string;label?:string}):Promise<{rawKey:string;metadata:MerchantKeyMetadata}>{
    const rawKey=`ts_live_${randomBytes(32).toString("base64url")}`;
    const hash=hashApiKey(rawKey);
    const prefix=rawKey.slice(0,16);
    const lastFour=rawKey.slice(-4);
    const url=this.restUrl("merchant_api_keys");
    const rows=await this.requestJson<KeyRow[]>(url,{
      method:"POST",
      headers:{"content-type":"application/json",prefer:"return=representation"},
      body:JSON.stringify({
        merchant_id:input.merchantId,
        key_hash:hash,
        key_prefix:prefix,
        key_last_four:lastFour,
        label:input.label?.trim()||"Default managed gateway key",
      }),
    });
    const row=rows[0];
    if(!row) throw new ControlPlaneStoreError("API key creation returned no row.");
    return {rawKey,metadata:mapKey(row)};
  }

  async authenticateApiKey(rawKey:string):Promise<AuthenticatedMerchantKey|null>{
    const candidate=rawKey.trim();
    if(!candidate.startsWith("ts_live_")||candidate.length<32||candidate.length>160) return null;
    const url=this.restUrl("merchant_api_keys");
    url.searchParams.set("select","key_id,merchant_id,revoked_at,workspace:merchant_workspaces!inner(merchant_id,name,slug,status,created_at)");
    url.searchParams.set("key_hash",`eq.${hashApiKey(candidate)}`);
    url.searchParams.set("revoked_at","is.null");
    url.searchParams.set("limit","1");
    const rows=await this.requestJson<AuthRow[]>(url,{method:"GET"});
    const row=rows[0];
    if(!row||row.revoked_at!==null) return null;
    const workspace=Array.isArray(row.workspace)?row.workspace[0]:row.workspace;
    if(!workspace||workspace.status!=="ACTIVE"||workspace.merchant_id!==row.merchant_id) return null;

    const touch=this.restUrl("merchant_api_keys");
    touch.searchParams.set("key_id",`eq.${row.key_id}`);
    await this.request(touch,{
      method:"PATCH",
      headers:{"content-type":"application/json",prefer:"return=minimal"},
      body:JSON.stringify({last_used_at:new Date().toISOString()}),
    });
    return {merchantId:row.merchant_id,keyId:row.key_id};
  }

  async hasActiveIntegration(merchantId:string,integrationId:string,environment?:string):Promise<boolean>{
    const scopedMerchantId=merchantId.trim();
    const scopedIntegrationId=integrationId.trim();
    const scopedEnvironment=environment?.trim();
    if(!scopedMerchantId||!scopedIntegrationId) return false;
    const url=this.restUrl("merchant_integrations");
    url.searchParams.set("select","merchant_integration_id");
    url.searchParams.set("merchant_id",`eq.${scopedMerchantId}`);
    url.searchParams.set("integration_id",`eq.${scopedIntegrationId}`);
    url.searchParams.set("lifecycle_status","eq.ACTIVE");
    if(scopedEnvironment) url.searchParams.set("environment",`eq.${scopedEnvironment}`);
    url.searchParams.set("limit","1");
    const rows=await this.requestJson<Array<{merchant_integration_id:string}>>(url,{method:"GET"});
    return rows.length===1;
  }

  async listWorkspaces():Promise<readonly MerchantWorkspaceSummary[]>{
    const workspacesUrl=this.restUrl("merchant_workspaces");
    workspacesUrl.searchParams.set("select","merchant_id,name,slug,status,created_at");
    workspacesUrl.searchParams.set("order","created_at.desc");
    const integrationsUrl=this.restUrl("merchant_integrations");
    integrationsUrl.searchParams.set("select","merchant_integration_id,merchant_id,preset_id,integration_id,environment,lifecycle_status,purpose_contract,installed_at");
    integrationsUrl.searchParams.set("order","installed_at.desc");
    const keysUrl=this.restUrl("merchant_api_keys");
    keysUrl.searchParams.set("select","key_id,merchant_id,key_prefix,key_last_four,label,created_at,last_used_at,revoked_at");
    keysUrl.searchParams.set("order","created_at.desc");

    const [workspaceRows,integrationRows,keyRows]=await Promise.all([
      this.requestJson<WorkspaceRow[]>(workspacesUrl,{method:"GET"}),
      this.requestJson<IntegrationRow[]>(integrationsUrl,{method:"GET"}),
      this.requestJson<KeyRow[]>(keysUrl,{method:"GET"}),
    ]);
    return workspaceRows.map((row)=>({
      ...mapWorkspace(row),
      integrations:integrationRows.filter((item)=>item.merchant_id===row.merchant_id).map(mapIntegration),
      apiKeys:keyRows.filter((item)=>item.merchant_id===row.merchant_id).map(mapKey),
    }));
  }

  private restUrl(table:string):URL{
    return new URL(`/rest/v1/${table}`,`${this.projectUrl}/`);
  }

  private async requestJson<T>(url:URL,init:RequestInit):Promise<T>{
    const response=await this.request(url,init);
    try{return await response.json() as T}catch{throw new ControlPlaneStoreError("Supabase returned invalid JSON.");}
  }

  private async request(url:URL,init:RequestInit):Promise<Response>{
    const headers=new Headers(init.headers);
    headers.set("apikey",this.serviceRoleKey);
    headers.set("authorization",`Bearer ${this.serviceRoleKey}`);
    headers.set("accept","application/json");
    let response:Response;
    try{
      response=await this.fetchImpl(url,{...init,headers,cache:"no-store",redirect:"manual"});
    }catch{
      throw new ControlPlaneStoreError("Control-plane persistence request failed.");
    }
    if(!response.ok) throw new ControlPlaneStoreError(`Control-plane persistence returned HTTP ${response.status}.`);
    return response;
  }
}

export function hashApiKey(rawKey:string):string{
  return createHash("sha256").update(rawKey).digest("hex");
}

function mapWorkspace(row:WorkspaceRow):MerchantWorkspace{
  return {merchantId:row.merchant_id,name:row.name,slug:row.slug,status:row.status,createdAt:row.created_at};
}

function mapIntegration(row:IntegrationRow):MerchantIntegration{
  return {
    merchantIntegrationId:row.merchant_integration_id,
    merchantId:row.merchant_id,
    presetId:row.preset_id,
    integrationId:row.integration_id,
    environment:row.environment,
    lifecycleStatus:row.lifecycle_status,
    purposeContract:row.purpose_contract,
    installedAt:row.installed_at,
  };
}

function mapKey(row:KeyRow):MerchantKeyMetadata{
  return {
    keyId:row.key_id,
    merchantId:row.merchant_id,
    keyPrefix:row.key_prefix,
    keyLastFour:row.key_last_four,
    label:row.label,
    createdAt:row.created_at,
    lastUsedAt:row.last_used_at,
    revokedAt:row.revoked_at,
  };
}

function normalizeProjectUrl(value:string):string{
  let url:URL;
  try{url=new URL(value)}catch{throw new ControlPlaneStoreError("Supabase project URL must be valid.");}
  const local=url.hostname==="localhost"||url.hostname==="127.0.0.1";
  if(url.protocol!=="https:"&&!(local&&url.protocol==="http:")) throw new ControlPlaneStoreError("Supabase project URL must use HTTPS.");
  return url.origin;
}
