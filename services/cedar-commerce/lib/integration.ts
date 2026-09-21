import { randomUUID } from "node:crypto";
import { db, hasDatabase } from "./db";
import { hmac } from "./security";
import { getScenario } from "./commerce-store";
import type { Order } from "./types";

export interface GatewayResult { decision:string;reasonCode:string;allowedFields:string[];blockedFields:string[];partnerDelivered:boolean;forbiddenFieldDelivered:boolean;evidenceId:string }

export async function emitCheckoutCompleted(order:Order):Promise<GatewayResult|null>{
  const url=process.env.THIRDSIGHT_GATEWAY_URL?.trim(); const secret=process.env.THIRDSIGHT_INTEGRATION_SECRET?.trim();
  if(!url||!secret){if(process.env.NODE_ENV==="production")console.error("[CEDAR] Gateway integration is not configured.");return null;}
  const scenario=await getScenario(); const first=order.lines[0]; const integrationId=scenario==="shadow-integration"?"unregistered-shadow":scenario==="stale-crm"?"crm-partner":"analytics-partner";
  const fields:Record<string,unknown>={"order.id":order.orderNumber,"order.value":order.total,"product.id":first?.sku??"unknown","product.category":categoryFor(first?.sku??"")};
  if(scenario==="unauthorized-field")fields["customer.phone"]=order.phone;
  const idempotencyKey=`evt_${order.id}`;
  const payload={merchantId:process.env.THIRDSIGHT_MERCHANT_ID??"cedar-commerce",integrationId,purpose:integrationId==="crm-partner"?"customer-relationship":"purchase-measurement",eventName:"checkout.completed",idempotencyKey,occurredAt:new Date().toISOString(),fields,context:{source:"cedar-backend",environment:"synthetic-demo",scenario}};
  const body=JSON.stringify(payload); const timestamp=String(Date.now());
  if(hasDatabase())await db()`insert into cedar_commerce.integration_events(order_id,integration_id,event_name,purpose,scenario,attempted_payload,idempotency_key) values(${order.id},${integrationId},'checkout.completed',${payload.purpose},${scenario},${db().json(payload as any)},${idempotencyKey}) on conflict(idempotency_key) do nothing`;
  try{
    const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json","x-cedar-timestamp":timestamp,"x-cedar-signature":hmac(secret,timestamp,body)},body,cache:"no-store"});
    const result=await response.json() as GatewayResult;
    if(!response.ok)throw new Error(`Gateway rejected event (${response.status}).`);
    if(hasDatabase())await db()`update cedar_commerce.integration_events set status='DELIVERED',gateway_response=${db().json(result as any)},evidence_id=${result.evidenceId},dispatched_at=now() where idempotency_key=${idempotencyKey}`;
    return result;
  }catch(error){
    if(hasDatabase())await db()`update cedar_commerce.integration_events set status='FAILED',gateway_response=${db().json({error:error instanceof Error?error.message:"Gateway failure"})},dispatched_at=now() where idempotency_key=${idempotencyKey}`;
    console.error("[CEDAR] Optional integration dispatch failed."); return null;
  }
}

function categoryFor(sku:string){if(sku.startsWith("CA"))return"phones";if(sku.startsWith("AH"))return"headphones";if(sku.startsWith("PBP"))return"earbuds";return"accessories";}
