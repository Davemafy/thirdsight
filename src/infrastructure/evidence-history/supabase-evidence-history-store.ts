import type { IntegrationBindingConfidence, IntegrationOriginBinding } from "../../domain/integration-identity.js";
import {
  purposeContractEvidence,
  businessEventEvidence,
  capabilityGrantEvidence,
  type PurposeContract,
  type BusinessEvent,
  type CapabilityGrant,
  type BusinessEventEvidence,
} from "../../domain/evidence-sources.js";
import type { EvidenceHistoryEntry, EvidenceHistoryStore } from "./evidence-history-store.js";

interface SupabaseEvidenceHistoryStoreConfig {
  projectUrl:string;
  serviceRoleKey:string;
  merchantId?:string;
  fetchImpl?:typeof fetch;
}

interface OriginBindingRow {
  binding_id:string;
  integration_id:string;
  origin:string;
  environment:string;
  confidence:string;
  source_id:string;
  valid_from:string;
  valid_to:string|null;
}

interface EvidenceHistoryRow { payload:unknown }

export class EvidencePersistenceError extends Error {
  constructor(message:string){
    super(message);
    this.name="EvidencePersistenceError";
  }
}

export class SupabaseEvidenceHistoryStore implements EvidenceHistoryStore {
  private readonly projectUrl:string;
  private readonly serviceRoleKey:string;
  private readonly merchantId:string|null;
  private readonly fetchImpl:typeof fetch;

  constructor(config:SupabaseEvidenceHistoryStoreConfig){
    this.projectUrl=normalizeProjectUrl(config.projectUrl);
    this.serviceRoleKey=config.serviceRoleKey.trim();
    this.merchantId=config.merchantId?.trim()||null;
    this.fetchImpl=config.fetchImpl??fetch;
    if(!this.serviceRoleKey) throw new EvidencePersistenceError("Supabase service-role key is required.");
    if(config.merchantId!==undefined&&!this.merchantId) throw new EvidencePersistenceError("Merchant ID must not be empty.");
  }

  async findActiveOriginBindings(origin:string,environment:string,observedAt:string):Promise<readonly IntegrationOriginBinding[]>{
    const url=this.restUrl("integration_origin_bindings");
    url.searchParams.set("select","binding_id,integration_id,origin,environment,confidence,source_id,valid_from,valid_to");
    url.searchParams.set("origin",`eq.${new URL(origin).origin}`);
    url.searchParams.set("environment",`eq.${environment}`);
    const rows=await this.requestJson<OriginBindingRow[]>(url,{method:"GET"});
    const at=Date.parse(observedAt);
    return rows.map(parseBindingRow).filter((binding):binding is IntegrationOriginBinding=>binding!==null).filter((binding)=>{
      const from=Date.parse(binding.validFrom);
      const until=binding.validTo===null?null:Date.parse(binding.validTo);
      return from<=at&&(until===null||until>at);
    });
  }

  async findPurposeContracts(integrationId:string,environment:string,observedAt:string){
    if(this.merchantId){
      const url=this.restUrl("merchant_integrations");
      url.searchParams.set("select","purpose_contract");
      url.searchParams.set("merchant_id",`eq.${this.merchantId}`);
      url.searchParams.set("integration_id",`eq.${integrationId}`);
      url.searchParams.set("environment",`eq.${environment}`);
      url.searchParams.set("lifecycle_status","eq.ACTIVE");
      const rows=await this.requestJson<Array<{purpose_contract:PurposeContract}>>(url,{method:"GET"});
      const at=Date.parse(observedAt);
      return rows
        .map((row)=>purposeContractEvidence(row.purpose_contract,`merchant:${this.merchantId}:${row.purpose_contract.contractId}:${row.purpose_contract.version}`))
        .filter((item)=>Date.parse(item.contract.validFrom)<=at&&(item.contract.expiresAt===null||Date.parse(item.contract.expiresAt)>at));
    }
    const url=this.restUrl("purpose_contracts");
    url.searchParams.set("select","payload");
    url.searchParams.set("integration_id",`eq.${integrationId}`);
    url.searchParams.set("environment",`eq.${environment}`);
    const rows=await this.requestJson<Array<{payload:PurposeContract}>>(url,{method:"GET"});
    const at=Date.parse(observedAt);
    return rows.map((row)=>purposeContractEvidence(row.payload,`${row.payload.contractId}:${row.payload.version}`))
      .filter((item)=>Date.parse(item.contract.validFrom)<=at&&(item.contract.expiresAt===null||Date.parse(item.contract.expiresAt)>at));
  }

  async findCapabilities(integrationId:string,environment:string,observedAt:string){
    const url=this.restUrl("capability_grants");
    url.searchParams.set("select","payload");
    url.searchParams.set("integration_id",`eq.${integrationId}`);
    url.searchParams.set("environment",`eq.${environment}`);
    const rows=await this.requestJson<Array<{payload:CapabilityGrant}>>(url,{method:"GET"});
    const at=Date.parse(observedAt);
    return rows.map((row)=>capabilityGrantEvidence(row.payload))
      .filter((item)=>Date.parse(item.capability.validFrom)<=at&&(item.capability.validTo===null||Date.parse(item.capability.validTo)>at));
  }

  async findBusinessEvents(integrationId:string,observedAt:string){
    const url=this.restUrl("business_events");
    url.searchParams.set("select","payload");
    url.searchParams.set("integration_id",`eq.${integrationId}`);
    if(this.merchantId) url.searchParams.set("merchant_id",`eq.${this.merchantId}`);
    const rows=await this.requestJson<Array<{payload:BusinessEvent}>>(url,{method:"GET"});
    const at=Date.parse(observedAt);
    return rows.map((row)=>businessEventEvidence(row.payload)).filter((item)=>{
      const delta=at-Date.parse(item.event.timestamp);
      return delta>=0&&delta<=300_000;
    });
  }

  async findIntegrationLifecycle(integrationId:string){
    if(this.merchantId){
      const url=this.restUrl("merchant_integrations");
      url.searchParams.set("select","integration_id,lifecycle_status,preset_id");
      url.searchParams.set("merchant_id",`eq.${this.merchantId}`);
      url.searchParams.set("integration_id",`eq.${integrationId}`);
      url.searchParams.set("limit","1");
      const rows=await this.requestJson<Array<{integration_id:string;lifecycle_status:"ACTIVE"|"RETIRED";preset_id:string}>>(url,{method:"GET"});
      const row=rows[0];
      return row?{integrationId:row.integration_id,displayName:humanize(row.preset_id),lifecycleStatus:row.lifecycle_status,owner:this.merchantId}:null;
    }
    const url=this.restUrl("integration_registry");
    url.searchParams.set("select","integration_id,display_name,lifecycle_status,owner");
    url.searchParams.set("integration_id",`eq.${integrationId}`);
    url.searchParams.set("limit","1");
    const rows=await this.requestJson<Array<{integration_id:string;display_name:string;lifecycle_status:"ACTIVE"|"RETIRED";owner:string|null}>>(url,{method:"GET"});
    const row=rows[0];
    return row?{integrationId:row.integration_id,displayName:row.display_name,lifecycleStatus:row.lifecycle_status,owner:row.owner}:null;
  }

  async findCredential(credentialId:string){
    const url=this.restUrl("integration_credentials");
    url.searchParams.set("select","credential_id,integration_id,status,environment");
    url.searchParams.set("credential_id",`eq.${credentialId}`);
    url.searchParams.set("limit","1");
    const rows=await this.requestJson<Array<{credential_id:string;integration_id:string;status:"ACTIVE"|"REVOKED";environment:string}>>(url,{method:"GET"});
    const row=rows[0];
    return row?{credentialId:row.credential_id,integrationId:row.integration_id,status:row.status,environment:row.environment}:null;
  }

  async registerCredential(input:{credentialId:string;integrationId:string;environment:string;validFrom:string}):Promise<void>{
    const url=this.restUrl("integration_credentials");
    url.searchParams.set("on_conflict","credential_id");
    await this.request(url,{method:"POST",headers:{"content-type":"application/json",prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({
      credential_id:input.credentialId,integration_id:input.integrationId,environment:input.environment,status:"ACTIVE",valid_from:input.validFrom,revoked_at:null,
    })});
  }

  async isolateCredential(credentialId:string):Promise<boolean>{
    const url=this.restUrl("integration_credentials");
    url.searchParams.set("credential_id",`eq.${credentialId}`);
    const rows=await this.requestJson<Array<{credential_id:string}>>(url,{method:"PATCH",headers:{"content-type":"application/json",prefer:"return=representation"},body:JSON.stringify({status:"REVOKED",revoked_at:new Date().toISOString()})});
    return rows.some((row)=>row.credential_id===credentialId);
  }

  async appendBusinessEvent(event:BusinessEventEvidence):Promise<void>{
    await this.appendBusinessEvents([event]);
  }

  async appendBusinessEvents(events:readonly BusinessEventEvidence[]):Promise<void>{
    if(events.length===0) return;
    const url=this.restUrl("business_events");
    url.searchParams.set("on_conflict","event_id");
    await this.request(url,{method:"POST",headers:{"content-type":"application/json",prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(events.map((event)=>({
      // event.id is merchant supplied. Namespace the persistence key so one merchant
      // cannot collide with or overwrite another merchant's first-party event.
      event_id:this.merchantId?`${this.merchantId}:${event.event.id}`:event.event.id,
      integration_id:event.event.integrationId??null,
      occurred_at:event.event.timestamp,
      payload:event.event,
      ...(this.merchantId?{merchant_id:this.merchantId}:{}),
    })))});
  }

  async append(entry:EvidenceHistoryEntry):Promise<void>{
    await this.appendMany([entry]);
  }

  async appendMany(entries:readonly EvidenceHistoryEntry[]):Promise<void>{
    if(entries.length===0) return;
    const url=this.restUrl("browser_evidence_history");
    url.searchParams.set("on_conflict","record_id");
    await this.request(url,{method:"POST",headers:{"content-type":"application/json",prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(entries.map((entry)=>({
      record_id:entry.recordId,
      observation_id:entry.observationId,
      accepted_at:entry.acceptedAt,
      observed_at:entry.evidence.observedAt,
      destination_origin:entry.evidence.did.value?.destinationOrigin??null,
      integration_id:entry.evidence.integrationId,
      integration_resolution:entry.evidence.integrationResolution,
      payload:entry,
      findings:entry.findings??[],
      enforcement:entry.enforcement??null,
      outcome:entry.outcome??null,
      ...(this.merchantId?{merchant_id:this.merchantId}:{}),
    })))});
  }

  async list(limit=50):Promise<readonly EvidenceHistoryEntry[]>{
    const safeLimit=Math.max(1,Math.min(750,Math.floor(limit)));
    const url=this.restUrl("browser_evidence_history");
    url.searchParams.set("select","payload");
    url.searchParams.set("order","observed_at.desc");
    url.searchParams.set("limit",String(safeLimit));
    if(this.merchantId) url.searchParams.set("merchant_id",`eq.${this.merchantId}`);
    const rows=await this.requestJson<EvidenceHistoryRow[]>(url,{method:"GET"});
    return rows.map((row)=>row.payload).filter(isEvidenceHistoryEntry);
  }

  async findByRecordId(recordId:string):Promise<EvidenceHistoryEntry|null>{
    const id=recordId.trim();
    if(!id) return null;
    const url=this.restUrl("browser_evidence_history");
    url.searchParams.set("select","payload");
    url.searchParams.set("record_id",`eq.${id}`);
    url.searchParams.set("limit","1");
    if(this.merchantId) url.searchParams.set("merchant_id",`eq.${this.merchantId}`);
    const rows=await this.requestJson<EvidenceHistoryRow[]>(url,{method:"GET"});
    const payload=rows[0]?.payload;
    return isEvidenceHistoryEntry(payload)?payload:null;
  }

  private restUrl(table:string):URL{
    return new URL(`/rest/v1/${table}`,`${this.projectUrl}/`);
  }

  private async requestJson<T>(url:URL,init:RequestInit):Promise<T>{
    const response=await this.request(url,init);
    try{return await response.json() as T}catch{throw new EvidencePersistenceError("Supabase returned invalid JSON.");}
  }

  private async request(url:URL,init:RequestInit):Promise<Response>{
    const headers=new Headers(init.headers);
    headers.set("apikey",this.serviceRoleKey);
    headers.set("authorization",`Bearer ${this.serviceRoleKey}`);
    headers.set("accept","application/json");
    let response:Response;
    try{response=await this.fetchImpl(url,{...init,headers,cache:"no-store",redirect:"manual"})}
    catch{throw new EvidencePersistenceError("Supabase request failed.");}
    if(!response.ok){
      const detail=await response.text().catch(()=>"");
      throw new EvidencePersistenceError(`Supabase request failed with ${response.status}${detail?`: ${detail.slice(0,300)}`:""}`);
    }
    return response;
  }
}

function normalizeProjectUrl(value:string):string{
  let parsed:URL;
  try{parsed=new URL(value)}catch{throw new EvidencePersistenceError("Supabase project URL must be a valid URL.");}
  const local=parsed.hostname==="localhost"||parsed.hostname==="127.0.0.1";
  if(parsed.protocol!=="https:"&&!(local&&parsed.protocol==="http:")) throw new EvidencePersistenceError("Supabase project URL must use HTTPS, except for localhost development.");
  return parsed.origin;
}

function parseBindingRow(row:OriginBindingRow):IntegrationOriginBinding|null{
  if(!isBindingConfidence(row.confidence)) return null;
  if(!row.binding_id||!row.integration_id||!row.origin||!row.environment) return null;
  if(!row.source_id||Number.isNaN(Date.parse(row.valid_from))) return null;
  if(row.valid_to!==null&&Number.isNaN(Date.parse(row.valid_to))) return null;
  return {bindingId:row.binding_id,integrationId:row.integration_id,origin:row.origin,environment:row.environment,confidence:row.confidence,sourceId:row.source_id,validFrom:row.valid_from,validTo:row.valid_to};
}

function isBindingConfidence(value:string):value is IntegrationBindingConfidence{
  return value==="AUTHORITATIVE"||value==="DECLARED";
}

function isEvidenceHistoryEntry(value:unknown):value is EvidenceHistoryEntry{
  if(typeof value!=="object"||value===null||Array.isArray(value)) return false;
  const record=value as Record<string,unknown>;
  return typeof record.recordId==="string"&&typeof record.observationId==="string"&&typeof record.acceptedAt==="string"&&typeof record.observation==="object"&&record.observation!==null&&typeof record.evidence==="object"&&record.evidence!==null&&typeof record.integrationResolution==="object"&&record.integrationResolution!==null;
}

function humanize(value:string):string{
  return value.split(/[-_]/g).filter(Boolean).map((part)=>part.charAt(0).toUpperCase()+part.slice(1)).join(" ");
}
