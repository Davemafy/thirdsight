import { createHash } from "node:crypto";
import { db, hasDatabase } from "./db";
import { hmac } from "./security";
import { getScenario } from "./commerce-store";
import type { Order } from "./types";

export interface GatewayResult {
  decision:string;
  reasonCode:string;
  allowedFields:string[];
  blockedFields:string[];
  partnerDelivered:boolean;
  forbiddenFieldDelivered:boolean;
  evidenceId:string;
  deliveryEvidenceId?:string|null;
}

export async function emitCheckoutCompleted(order:Order):Promise<GatewayResult|null>{
  const scenario=await getScenario();
  const managedUrl=process.env.THIRDSIGHT_MANAGED_GATEWAY_URL?.trim();
  const managedKey=process.env.THIRDSIGHT_GATEWAY_API_KEY?.trim();

  if(managedUrl&&managedKey&&(scenario==="normal"||scenario==="unauthorized-field")){
    return emitManagedCommerce(order,scenario,managedUrl,managedKey);
  }

  return emitLegacyGateway(order,scenario);
}

async function emitManagedCommerce(
  order:Order,
  scenario:"normal"|"unauthorized-field",
  gatewayUrl:string,
  gatewayKey:string,
):Promise<GatewayResult|null>{
  const first=order.lines[0];
  const orderRefHash=hashRef(order.id);
  const analyticsBody:Record<string,unknown>={
    order:{id:order.orderNumber,value:order.total},
    product:{
      id:first?.sku??"unknown",
      category:categoryFor(first?.sku??""),
      price:first?.unitPrice??0,
    },
  };
  if(scenario==="unauthorized-field"){
    analyticsBody.customer={phone:order.phone};
  }

  const deliveryBody={
    order:{id:order.orderNumber},
    customer:{phone:order.phone},
    delivery:{
      address:String(order.deliveryAddress.line1??""),
      city:String(order.deliveryAddress.city??""),
      state:String(order.deliveryAddress.state??""),
    },
    items:order.lines.map((line)=>({sku:line.sku,quantity:line.quantity})),
  };

  const analytics=await sendManaged({
    gatewayUrl,
    gatewayKey,
    integrationId:"cedar-analytics",
    path:"/ingest/managed/analytics",
    body:analyticsBody,
    context:{
      businessEvent:{
        id:`cedar-analytics:${order.id}`,
        type:"checkout.completed",
        timestamp:order.createdAt,
        orderRefHash,
      },
      requestRefs:{orderRefHash},
    },
  }).catch((error)=>{
    console.error("[CEDAR] Managed analytics dispatch failed.",error instanceof Error?error.message:"Unknown failure");
    return null;
  });

  const delivery=await sendManaged({
    gatewayUrl,
    gatewayKey,
    integrationId:"cedar-delivery",
    path:"/ingest/managed/delivery",
    body:deliveryBody,
    context:{
      businessEvent:{
        id:`cedar-delivery:${order.id}`,
        type:"order.ready_for_fulfilment",
        timestamp:order.createdAt,
        orderRefHash,
      },
      requestRefs:{orderRefHash},
    },
  }).catch((error)=>{
    console.error("[CEDAR] Managed delivery dispatch failed.",error instanceof Error?error.message:"Unknown failure");
    return null;
  });

  if(!analytics&&!delivery) return null;

  const primary=analytics??delivery!;
  const result:GatewayResult={
    decision:primary.decision,
    reasonCode:primary.decision==="CONSTRAIN"?"SCOPE_DRIFT":primary.decision,
    allowedFields:primary.receivedFields,
    blockedFields:[],
    partnerDelivered:primary.partnerDelivered,
    forbiddenFieldDelivered:primary.forbiddenFieldReceived,
    evidenceId:primary.evidenceId,
    deliveryEvidenceId:delivery?.evidenceId??null,
  };

  if(hasDatabase()){
    await db()`
      insert into cedar_commerce.integration_events(
        order_id,integration_id,event_name,purpose,scenario,attempted_payload,idempotency_key,status,gateway_response,evidence_id,dispatched_at
      ) values(
        ${order.id},'cedar-analytics','checkout.completed','product-and-purchase-analytics',${scenario},
        ${db().json(analyticsBody as any)},${`managed:${order.id}:analytics`},'DELIVERED',
        ${db().json(result as any)},${result.evidenceId},now()
      )
      on conflict(idempotency_key) do update set
        status='DELIVERED',gateway_response=excluded.gateway_response,evidence_id=excluded.evidence_id,dispatched_at=now()
    `;
  }
  return result;
}

async function sendManaged(input:{
  gatewayUrl:string;
  gatewayKey:string;
  integrationId:string;
  path:string;
  body:Record<string,unknown>;
  context:Record<string,unknown>;
}):Promise<{
  decision:string;
  evidenceId:string;
  partnerDelivered:boolean;
  receivedFields:string[];
  forbiddenFieldReceived:boolean;
}>{
  const target=new URL(input.gatewayUrl);
  target.searchParams.set("integration",input.integrationId);
  target.searchParams.set("environment","synthetic-demo");
  target.searchParams.set("path",input.path);

  const response=await fetch(target,{
    method:"POST",
    headers:{
      "content-type":"application/json",
      authorization:`Bearer ${input.gatewayKey}`,
      "x-thirdsight-context":JSON.stringify(input.context),
    },
    body:JSON.stringify(input.body),
    cache:"no-store",
    redirect:"manual",
  });

  const responseBody=await response.text();
  if(!response.ok){
    throw new Error(`Managed gateway rejected ${input.integrationId} with HTTP ${response.status}.`);
  }

  let parsed:{receivedFields?:unknown;forbiddenFieldReceived?:unknown}={};
  try{parsed=JSON.parse(responseBody) as typeof parsed}catch{}
  const receivedFields=Array.isArray(parsed.receivedFields)
    ?parsed.receivedFields.filter((value):value is string=>typeof value==="string")
    :[];

  return {
    decision:response.headers.get("x-thirdsight-decision")??"UNKNOWN",
    evidenceId:response.headers.get("x-thirdsight-request-id")??"",
    partnerDelivered:true,
    receivedFields,
    forbiddenFieldReceived:parsed.forbiddenFieldReceived===true,
  };
}

async function emitLegacyGateway(order:Order,scenario:Awaited<ReturnType<typeof getScenario>>):Promise<GatewayResult|null>{
  const url=process.env.THIRDSIGHT_GATEWAY_URL?.trim();
  const secret=process.env.THIRDSIGHT_INTEGRATION_SECRET?.trim();
  if(!url||!secret){
    if(process.env.NODE_ENV==="production") console.error("[CEDAR] Gateway integration is not configured.");
    return null;
  }

  const first=order.lines[0];
  const integrationId=scenario==="shadow-integration"?"unregistered-shadow":scenario==="stale-crm"?"crm-partner":"analytics-partner";
  const fields:Record<string,unknown>={
    "order.id":order.orderNumber,
    "order.value":order.total,
    "product.id":first?.sku??"unknown",
    "product.category":categoryFor(first?.sku??""),
  };
  if(scenario==="unauthorized-field") fields["customer.phone"]=order.phone;
  const idempotencyKey=`evt_${order.id}`;
  const payload={
    merchantId:process.env.THIRDSIGHT_MERCHANT_ID??"cedar-commerce",
    integrationId,
    purpose:integrationId==="crm-partner"?"customer-relationship":"purchase-measurement",
    eventName:"checkout.completed",
    idempotencyKey,
    occurredAt:new Date().toISOString(),
    fields,
    context:{source:"cedar-backend",environment:"synthetic-demo",scenario},
  };
  const body=JSON.stringify(payload);
  const timestamp=String(Date.now());

  if(hasDatabase()){
    await db()`
      insert into cedar_commerce.integration_events(order_id,integration_id,event_name,purpose,scenario,attempted_payload,idempotency_key)
      values(${order.id},${integrationId},'checkout.completed',${payload.purpose},${scenario},${db().json(payload as any)},${idempotencyKey})
      on conflict(idempotency_key) do nothing
    `;
  }

  try{
    const response=await fetch(url,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        "x-cedar-timestamp":timestamp,
        "x-cedar-signature":hmac(secret,timestamp,body),
      },
      body,
      cache:"no-store",
    });
    const result=await response.json() as GatewayResult;
    if(!response.ok) throw new Error(`Gateway rejected event (${response.status}).`);
    if(hasDatabase()){
      await db()`
        update cedar_commerce.integration_events
        set status='DELIVERED',gateway_response=${db().json(result as any)},evidence_id=${result.evidenceId},dispatched_at=now()
        where idempotency_key=${idempotencyKey}
      `;
    }
    return result;
  }catch(error){
    if(hasDatabase()){
      await db()`
        update cedar_commerce.integration_events
        set status='FAILED',gateway_response=${db().json({error:error instanceof Error?error.message:"Gateway failure"})},dispatched_at=now()
        where idempotency_key=${idempotencyKey}
      `;
    }
    console.error("[CEDAR] Optional integration dispatch failed.");
    return null;
  }
}

function hashRef(value:string):string{
  return createHash("sha256").update(value).digest("hex");
}

function categoryFor(sku:string){
  if(sku.startsWith("CA"))return"phones";
  if(sku.startsWith("AH"))return"headphones";
  if(sku.startsWith("PBP"))return"earbuds";
  return"accessories";
}
