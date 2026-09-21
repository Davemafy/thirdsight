import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export interface GatewayDispatchInput {
  merchantId:string; integrationId:string; purpose:string; eventName:string; idempotencyKey:string;
  occurredAt:string; fields:Record<string,unknown>; context:{source:string;environment:string;scenario?:string};
}
export const GATEWAY_MAX_AGE_MS=300_000;

export function parseGatewayInput(value:unknown):GatewayDispatchInput|null{
  if(!object(value))return null;const context=value.context,fields=value.fields;
  if(!object(context)||!object(fields)||Array.isArray(fields)||Object.keys(fields).length===0||Object.keys(fields).length>64)return null;
  const required=["merchantId","integrationId","purpose","eventName","idempotencyKey","occurredAt"] as const;
  if(required.some(k=>typeof value[k]!=="string"||value[k].trim().length<2||value[k].length>180))return null;
  if(typeof context.source!=="string"||typeof context.environment!=="string")return null;
  if(!Number.isFinite(Date.parse(value.occurredAt as string)))return null;
  if(Object.keys(fields).some(k=>!/^([a-z][a-z0-9_-]*)(\.[a-z][a-z0-9_-]*)+$/.test(k)||k.length>100))return null;
  return value as unknown as GatewayDispatchInput;
}
export function gatewaySignature(secret:string,timestamp:string,body:string){return createHmac("sha256",secret).update(`${timestamp}.${body}`).digest("hex")}
export function verifyGatewaySignature(secret:string,timestamp:string,body:string,provided:string,now=Date.now()){
  if(secret.length<16||!/^\d{13}$/.test(timestamp)||Math.abs(now-Number(timestamp))>GATEWAY_MAX_AGE_MS)return false;
  const expected=Buffer.from(gatewaySignature(secret,timestamp,body)),actual=Buffer.from(provided);return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
export function signatureHash(signature:string){return createHash("sha256").update(signature).digest("hex")}
export function resolveRegisteredIntegration(id:string,env:Record<string,string|undefined>){
  const map:Record<string,{purpose:string;receiver:"analytics"|"advertising"|"crm";url:string|undefined}>={
    "analytics-partner":{purpose:"purchase-measurement",receiver:"analytics",url:env.PARTNER_ANALYTICS_URL},
    "advertising-partner":{purpose:"conversion-attribution",receiver:"advertising",url:env.PARTNER_ADVERTISING_URL},
    "crm-partner":{purpose:"customer-relationship",receiver:"crm",url:env.PARTNER_CRM_URL},
  };return map[id]??null;
}
function object(v:unknown):v is Record<string,any>{return typeof v==="object"&&v!==null&&!Array.isArray(v)}
