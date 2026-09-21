import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { hasReplay, saveDelivery } from "./store";

type ManagedReceiver="managed-analytics"|"managed-delivery";

export async function managedIngest(receiver:ManagedReceiver,req:NextRequest){
  const expected=process.env.PARTNER_MANAGED_TOKEN?.trim()??"";
  if(expected.length<16||!authorized(req.headers.get("authorization")??"",expected)){
    return NextResponse.json({error:"INVALID_GATEWAY_AUTH"},{status:401});
  }

  const requestId=req.headers.get("x-thirdsight-request-id")?.trim()??"";
  if(requestId.length<8||requestId.length>160){
    return NextResponse.json({error:"REQUEST_ID_REQUIRED"},{status:400});
  }
  if(await hasReplay(requestId)){
    return NextResponse.json({error:"REPLAYED_REQUEST"},{status:409});
  }

  const text=await req.text();
  if(Buffer.byteLength(text,"utf8")>512_000){
    return NextResponse.json({error:"PAYLOAD_TOO_LARGE"},{status:413});
  }

  let payload:unknown;
  try{payload=JSON.parse(text)}catch{return NextResponse.json({error:"INVALID_JSON"},{status:400})}
  if(!isRecord(payload)){
    return NextResponse.json({error:"INVALID_PAYLOAD"},{status:422});
  }

  const fields=flattenFields(payload);
  const integrationId=receiver==="managed-analytics"?"cedar-analytics":"cedar-delivery";
  const delivery=await saveDelivery({
    receiver,
    merchantId:"cedar-commerce",
    integrationId,
    eventName:receiver==="managed-analytics"?"checkout.completed":"order.ready_for_fulfilment",
    receivedFields:fields,
    receivedPayload:payload,
    requestId,
    gatewaySignatureValid:true,
    gatewayTimestamp:new Date().toISOString(),
  });

  const forbiddenFieldReceived=receiver==="managed-analytics"&&fields.includes("customer.phone");
  return NextResponse.json({
    deliveryId:delivery.id,
    requestId,
    receivedFields:delivery.receivedFields,
    forbiddenFieldReceived,
  },{status:202});
}

function authorized(value:string,expected:string):boolean{
  if(!value.startsWith("Bearer ")) return false;
  const provided=value.slice(7).trim();
  if(!provided) return false;
  const left=createHash("sha256").update(provided).digest();
  const right=createHash("sha256").update(expected).digest();
  return timingSafeEqual(left,right);
}

function flattenFields(input:Record<string,unknown>):string[]{
  const output=new Set<string>();
  const walk=(value:unknown,path:string):void=>{
    if(value===null||typeof value!=="object"){
      if(path) output.add(path);
      return;
    }
    if(Array.isArray(value)){
      const arrayPath=path+"[]";
      if(value.length===0){if(path) output.add(arrayPath);return;}
      for(const item of value) walk(item,arrayPath);
      return;
    }
    const entries=Object.entries(value);
    if(entries.length===0){if(path) output.add(path);return;}
    for(const [key,item] of entries) walk(item,path?path+"."+key:key);
  };
  walk(input,"");
  return [...output].sort();
}

function isRecord(value:unknown):value is Record<string,unknown>{
  return typeof value==="object"&&value!==null&&!Array.isArray(value);
}
