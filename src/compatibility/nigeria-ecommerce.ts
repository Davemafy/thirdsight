import { NIGERIA_ECOMMERCE_INTEGRATIONS } from "../gateway/integration-registry.js";
import type { JsonObject } from "../managed/payload-paths.js";

export interface CompatibilityProfile {
  id:string;
  purpose:string;
  validTrigger:string;
  route:string;
  legitimatePayload:JsonObject;
  approvedFields:readonly string[];
  classification:"LIVE_SANDBOX"|"CONTROLLED_RECEIVER"|"SCHEMA_COMPATIBLE";
}

const routes=new Map(NIGERIA_ECOMMERCE_INTEGRATIONS.map((item)=>[item.id,item.allowedRoutes[0]?.path??"/"]));

export const NIGERIA_ECOMMERCE_COMPATIBILITY:readonly CompatibilityProfile[]=[
  {
    id:"paystack",purpose:"Initialize payment for an active checkout",validTrigger:"checkout.started",route:routes.get("paystack")!,
    legitimatePayload:{email:"ada@example.test",amount:"18990000",currency:"NGN",reference:"CED-2048"},
    approvedFields:["email","amount","currency","reference"],classification:"CONTROLLED_RECEIVER",
  },
  {
    id:"flutterwave",purpose:"Initialize payment for an active checkout",validTrigger:"checkout.started",route:routes.get("flutterwave")!,
    legitimatePayload:{tx_ref:"CED-2048",amount:189900,currency:"NGN",redirect_url:"https://merchant.example/complete",customer:{email:"ada@example.test",name:"Ada Example",phonenumber:"+2348000000000"}},
    approvedFields:["tx_ref","amount","currency","redirect_url","customer.email","customer.name","customer.phonenumber"],classification:"CONTROLLED_RECEIVER",
  },
  {
    id:"monnify",purpose:"Initialize merchant payment",validTrigger:"checkout.started",route:routes.get("monnify")!,
    legitimatePayload:{amount:189900,customerEmail:"ada@example.test",paymentReference:"CED-2048",paymentDescription:"CEDAR order",currencyCode:"NGN",contractCode:"demo-contract",redirectUrl:"https://merchant.example/complete"},
    approvedFields:["amount","customerEmail","paymentReference","paymentDescription","currencyCode","contractCode","redirectUrl"],classification:"CONTROLLED_RECEIVER",
  },
  {
    id:"interswitch",purpose:"Create a payment request",validTrigger:"checkout.started",route:routes.get("interswitch")!,
    legitimatePayload:{merchantCode:"MX6072",payableCode:"9405967",amount:"18990000",redirectUrl:"https://merchant.example/complete",customerId:"ada@example.test",currencyCode:"566",customerEmail:"ada@example.test"},
    approvedFields:["merchantCode","payableCode","amount","redirectUrl","customerId","currencyCode","customerEmail"],classification:"CONTROLLED_RECEIVER",
  },
  {
    id:"sendbox",purpose:"Create and fulfil a customer shipment",validTrigger:"order.ready_for_fulfilment",route:routes.get("sendbox")!,
    legitimatePayload:{origin:{first_name:"CEDAR",street:"12 Demo Street",state:"Lagos",city:"Lagos",country:"NG",phone:"+2348000000001"},destination:{first_name:"Ada",last_name:"Example",street:"12 Customer Street",state:"FCT",city:"Abuja",country:"NG",phone:"+2348000000000"},weight:1,region:"NG",service_type:"local",package_type:"general",total_value:189900,currency:"NGN",channel_code:"api",items:[{name:"Auralite H3",quantity:1,value:189900}]},
    approvedFields:["origin.first_name","origin.street","origin.state","origin.city","origin.country","origin.phone","destination.first_name","destination.last_name","destination.street","destination.state","destination.city","destination.country","destination.phone","weight","region","service_type","package_type","total_value","currency","channel_code","items[].name","items[].quantity","items[].value"],classification:"CONTROLLED_RECEIVER",
  },
  {
    id:"kwik",purpose:"Create a last-mile delivery task",validTrigger:"order.ready_for_fulfilment",route:routes.get("kwik")!,
    legitimatePayload:{pickup:{name:"CEDAR Lagos",phone:"+2348000000001"},delivery:{name:"Ada Example",phone:"+2348000000000",address:"12 Customer Street, Abuja"},package:{description:"Auralite H3",value:189900}},
    approvedFields:["pickup.name","pickup.phone","delivery.name","delivery.phone","delivery.address","package.description","package.value"],classification:"SCHEMA_COMPATIBLE",
  },
  {
    id:"termii",purpose:"Send an order-status notification",validTrigger:"order.status_changed",route:routes.get("termii")!,
    legitimatePayload:{to:"2348000000000",from:"CEDAR",sms:"Your CEDAR order is on the way.",type:"plain",channel:"dnd"},
    approvedFields:["to","from","sms","type","channel"],classification:"CONTROLLED_RECEIVER",
  },
  {
    id:"sendchamp",purpose:"Send an order-status notification",validTrigger:"order.status_changed",route:routes.get("sendchamp")!,
    legitimatePayload:{to:["2348000000000"],message:"Your CEDAR order is on the way.",sender_name:"CEDAR",route:"non_dnd"},
    approvedFields:["to[]","message","sender_name","route"],classification:"CONTROLLED_RECEIVER",
  },
  {
    id:"meta-capi",purpose:"Measure approved purchase conversions",validTrigger:"order.completed",route:"/v25.0/123456/events",
    legitimatePayload:{data:[{event_name:"Purchase",event_time:1789980000,event_id:"CED-2048",action_source:"website",user_data:{external_id:["synthetic-user-hash"]},custom_data:{currency:"NGN",value:189900,order_id:"CED-2048",content_ids:["auralite-h3"]}}]},
    approvedFields:["data[].event_name","data[].event_time","data[].event_id","data[].action_source","data[].user_data.external_id[]","data[].custom_data.currency","data[].custom_data.value","data[].custom_data.order_id","data[].custom_data.content_ids[]"],classification:"CONTROLLED_RECEIVER",
  },
  {
    id:"ga4",purpose:"Measure product and purchase analytics",validTrigger:"product.viewed",route:"/mp/collect?measurement_id=G-THIRDSIGHT",
    legitimatePayload:{client_id:"synthetic-client",events:[{name:"view_item",params:{currency:"NGN",value:189900,items:[{item_id:"auralite-h3",item_name:"Auralite H3",price:189900,quantity:1}]}}]},
    approvedFields:["client_id","events[].name","events[].params.currency","events[].params.value","events[].params.items[].item_id","events[].params.items[].item_name","events[].params.items[].price","events[].params.items[].quantity"],classification:"CONTROLLED_RECEIVER",
  },
];

export const COMPATIBILITY_SCENARIOS=["LEGITIMATE","EXTRA_FIELD","WRONG_BUSINESS_CONTEXT","RETIRED_INTEGRATION","BUSY_LEGITIMATE","FAILURE"] as const;
