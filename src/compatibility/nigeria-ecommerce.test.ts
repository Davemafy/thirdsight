import { describe, expect, it } from "vitest";
import { purposeContractEvidence } from "../domain/evidence-sources.js";
import { executeGatewayRequest } from "../gateway/gateway-core.js";
import { resolveGatewayIntegration } from "../gateway/integration-registry.js";
import type { GatewayIntegration } from "../gateway/gateway-types.js";
import { MemoryEvidenceStore } from "../gateway/test-store.js";
import type { JsonObject } from "../managed/payload-paths.js";
import { NIGERIA_ECOMMERCE_COMPATIBILITY } from "./nigeria-ecommerce.js";

const observedAt="2026-09-21T12:00:00.000Z";

for(const profile of NIGERIA_ECOMMERCE_COMPATIBILITY){
  describe("Nigeria ecommerce compatibility · "+profile.id,()=>{
    it("LEGITIMATE -> ALLOW",async()=>{
      const harness=createHarness(profile.id,profile.approvedFields,profile.purpose,profile.validTrigger);
      const result=await harness.run(profile.legitimatePayload,{eventId:"legit",eventType:profile.validTrigger});
      expect(result.decision).toBe("ALLOW");
      expect(result.upstreamContacted).toBe(true);
      expect(harness.received).toHaveLength(1);
    });

    it("EXTRA_FIELD -> CONSTRAIN before receiver",async()=>{
      const harness=createHarness(profile.id,profile.approvedFields,profile.purpose,profile.validTrigger);
      const result=await harness.run(addExtraField(profile.legitimatePayload),{eventId:"extra",eventType:profile.validTrigger});
      expect(result.decision).toBe("CONSTRAIN");
      expect(result.outcome).toBe("PREVENTED");
      expect(result.removedFields).toContain("customer.private_note");
      expect(result.transmittedFields).not.toContain("customer.private_note");
      expect(JSON.stringify(harness.received[0])).not.toContain("not-approved");
    });

    it("WRONG_BUSINESS_CONTEXT -> CONSTRAIN and no upstream contact",async()=>{
      const harness=createHarness(profile.id,profile.approvedFields,profile.purpose,profile.validTrigger);
      const result=await harness.run(profile.legitimatePayload,{
        eventId:"wrong-context",
        eventType:profile.validTrigger,
        eventOrderRef:"order-A",
        requestOrderRef:"order-B",
      });
      expect(result.decision).toBe("CONSTRAIN");
      expect(result.findings.some((finding)=>finding.type==="PURPOSE_MISMATCH")).toBe(true);
      expect(result.upstreamContacted).toBe(false);
      expect(harness.received).toHaveLength(0);
    });

    it("RETIRED_INTEGRATION -> ISOLATE and no upstream contact",async()=>{
      const harness=createHarness(profile.id,profile.approvedFields,profile.purpose,profile.validTrigger);
      harness.store.lifecycle={integrationId:profile.id,displayName:profile.id,lifecycleStatus:"RETIRED"};
      const result=await harness.run(profile.legitimatePayload,{eventId:"retired",eventType:profile.validTrigger});
      expect(result.decision).toBe("ISOLATE");
      expect(result.upstreamContacted).toBe(false);
      expect(harness.received).toHaveLength(0);
    });

    it("BUSY_LEGITIMATE -> 10x ALLOW with no false policy finding",async()=>{
      const harness=createHarness(profile.id,profile.approvedFields,profile.purpose,profile.validTrigger);
      const results=[];
      for(let index=0;index<10;index+=1){
        results.push(await harness.run(profile.legitimatePayload,{eventId:"busy-"+index,eventType:profile.validTrigger}));
      }
      expect(results.every((result)=>result.decision==="ALLOW"&&result.findings.length===0)).toBe(true);
      expect(harness.received).toHaveLength(10);
    });

    it("FAILURE -> configured failure mode",async()=>{
      const harness=createHarness(profile.id,profile.approvedFields,profile.purpose,profile.validTrigger);
      harness.store.failPolicy=true;
      if(harness.integration.failureMode==="CLOSED"){
        await expect(harness.run(profile.legitimatePayload,{eventId:"failure",eventType:profile.validTrigger}))
          .rejects.toMatchObject({code:"POLICY_UNAVAILABLE"});
        expect(harness.received).toHaveLength(0);
      }else{
        const result=await harness.run(profile.legitimatePayload,{eventId:"failure",eventType:profile.validTrigger});
        expect(result.decision).toBe("OBSERVE");
        expect(result.degraded).toBe(true);
        expect(result.evidencePersisted).toBe(true);
        expect(harness.received).toHaveLength(1);
      }
    });
  });
}

function createHarness(id:string,approvedFields:readonly string[],purpose:string,validTrigger:string){
  const base=resolveGatewayIntegration(id,id==="monnify"||id==="interswitch"||id==="sendbox"||id==="sendchamp"?"sandbox":"production",{
    PAYSTACK_SECRET_KEY:"test",FLUTTERWAVE_SECRET_KEY:"test",MONNIFY_ACCESS_TOKEN:"test",
    SENDBOX_ACCESS_TOKEN:"test",KWIK_API_KEY:"test",TERMII_API_KEY:"test",SENDCHAMP_ACCESS_KEY:"test",
    META_CAPI_ACCESS_TOKEN:"test",GA4_API_SECRET:"test",THIRDSIGHT_KWIK_UPSTREAM_ORIGIN:"https://kwik.example",
  });
  if(!base) throw new Error("Missing compatibility integration "+id);
  const integration:GatewayIntegration={...base,upstreamOrigin:"https://receiver.thirdsight.test",auth:{kind:"NONE"}};
  const profile=NIGERIA_ECOMMERCE_COMPATIBILITY.find((item)=>item.id===id);
  if(!profile) throw new Error("Missing profile "+id);
  const store=new MemoryEvidenceStore();
  store.contracts=[purposeContractEvidence({
    contractId:"compat-"+id,integrationId:id,version:"1",purpose,resources:["third-party-api"],fields:approvedFields,
    operations:["send"],validTriggers:[validTrigger],environment:integration.environment,
    validFrom:"2026-01-01T00:00:00.000Z",reviewAt:"2027-01-01T00:00:00.000Z",expiresAt:null,
    owner:"commerce",approvedBy:"merchant-security",changeReason:"Compatibility fixture",
  },"compat:"+id)];
  store.lifecycle={integrationId:id,displayName:id,lifecycleStatus:"ACTIVE"};

  const received:JsonObject[]=[];
  const fetchImpl:typeof fetch=async(_input,init)=>{
    if(typeof init?.body==="string") received.push(JSON.parse(init.body) as JsonObject);
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{"content-type":"application/json"}});
  };

  const run=async(payload:JsonObject,context:{
    eventId:string;eventType:string;eventOrderRef?:string;requestOrderRef?:string;
  })=>executeGatewayRequest({
    requestId:id+"-"+context.eventId,
    integrationId:id,
    environment:integration.environment,
    method:"POST",
    path:profile.route,
    contentType:"application/json",
    headers:{"content-type":"application/json"},
    body:payload,
    observedAt,
    context:{
      businessEvent:{
        id:id+"-"+context.eventId,
        type:context.eventType,
        timestamp:observedAt,
        ...(context.eventOrderRef?{orderRefHash:context.eventOrderRef}:{}),
      },
      ...(context.requestOrderRef?{requestRefs:{orderRefHash:context.requestOrderRef}}:{}),
    },
  },{
    store,fetchImpl,env:{},resolveIntegration:()=>integration,resolveAddresses:async()=>["8.8.8.8"],
  });

  return {store,received,integration,run};
}

function addExtraField(payload:JsonObject):JsonObject{
  const copy=JSON.parse(JSON.stringify(payload)) as JsonObject;
  const current=copy.customer;
  if(current&&typeof current==="object"&&!Array.isArray(current)){
    (current as JsonObject).private_note="not-approved";
  }else{
    copy.customer={private_note:"not-approved"};
  }
  return copy;
}
