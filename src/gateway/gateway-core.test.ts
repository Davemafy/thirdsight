import { describe, expect, it } from "vitest";
import { purposeContractEvidence } from "../domain/evidence-sources.js";
import { executeGatewayRequest } from "./gateway-core.js";
import type { GatewayIntegration } from "./gateway-types.js";
import { MemoryEvidenceStore } from "./test-store.js";

const observedAt="2026-09-21T12:00:00.000Z";

describe("generic managed HTTP gateway",()=>{
  it("rejects an unregistered integration before any outbound request",async()=>{
    const store=new MemoryEvidenceStore();
    let calls=0;
    await expect(executeGatewayRequest(request(),{
      store,
      fetchImpl:async()=>{calls+=1;return new Response("unexpected")},
      env:{},
      resolveIntegration:()=>null,
      resolveAddresses:async()=>["8.8.8.8"],
    })).rejects.toMatchObject({code:"INTEGRATION_NOT_REGISTERED"});
    expect(calls).toBe(0);
  });

  it("rejects oversized JSON before forwarding",async()=>{
    const harness=setup({maxBodyBytes:16});
    await expect(harness.run({message:"this body is too large"})).rejects.toMatchObject({code:"PAYLOAD_TOO_LARGE"});
    expect(harness.calls()).toBe(0);
  });

  it("rejects malformed JSON bodies",async()=>{
    const harness=setup();
    await expect(harness.runRaw("{not-json")).rejects.toThrow("valid JSON");
    expect(harness.calls()).toBe(0);
  });

  it("blocks unsupported content types when configured BLOCK",async()=>{
    const harness=setup({unsupportedPayloadMode:"BLOCK"});
    await expect(harness.runRaw("a=1","application/x-www-form-urlencoded")).rejects.toMatchObject({code:"UNSUPPORTED_CONTENT_TYPE"});
    expect(harness.calls()).toBe(0);
  });

  it("can explicitly OBSERVE and forward an opaque registered payload without field claims",async()=>{
    const harness=setup({unsupportedPayloadMode:"OBSERVE"});
    const result=await harness.runRaw("a=1","application/x-www-form-urlencoded");
    expect(result.decision).toBe("OBSERVE");
    expect(result.transmittedFields).toEqual([]);
    expect(result.upstreamContacted).toBe(true);
    expect(harness.calls()).toBe(1);
  });

  it.each([400,429,500])("preserves registered upstream HTTP %s",async(status)=>{
    const harness=setup({},status);
    const result=await harness.run({event:{name:"purchase"}});
    expect(result.responseStatus).toBe(status);
    expect(result.upstreamStatus).toBe(status);
    expect(result.upstreamContacted).toBe(true);
  });

  it("does not retry a failed POST",async()=>{
    const harness=setup({},200,true);
    await expect(harness.run({event:{name:"purchase"}})).rejects.toMatchObject({code:"UPSTREAM_UNAVAILABLE"});
    expect(harness.calls()).toBe(1);
  });

  it("does not turn evidence persistence failure into a false prevention or failed upstream call",async()=>{
    const harness=setup();
    harness.store.failAppend=true;
    const result=await harness.run({event:{name:"purchase"}});
    expect(result.responseStatus).toBe(200);
    expect(result.evidencePersisted).toBe(false);
    expect(result.outcome).toBeNull();
    expect(harness.calls()).toBe(1);
  });

  it("handles concurrent legitimate managed requests without false policy findings",async()=>{
    const harness=setup();
    const results=await Promise.all(Array.from({length:12},(_,index)=>
      harness.run({event:{name:"purchase-"+index}},index)
    ));
    expect(results.every((result)=>result.decision==="ALLOW"&&result.findings.length===0)).toBe(true);
    expect(harness.calls()).toBe(12);
  });
});

function setup(
  overrides:Partial<GatewayIntegration>={},
  status=200,
  throwNetwork=false,
){
  const integration:GatewayIntegration={
    id:"test-integration",
    name:"Test integration",
    environment:"production",
    upstreamOrigin:"https://api.example.com",
    allowedRoutes:[{method:"POST",path:"/v1/events"}],
    allowedContentTypes:["application/json"],
    auth:{kind:"NONE"},
    failureMode:"CLOSED",
    unsupportedPayloadMode:"BLOCK",
    timeoutMs:1000,
    maxBodyBytes:100_000,
    compatibilityStatus:"CONTROLLED_RECEIVER",
    documentationUrl:"https://example.com/docs",
    ...overrides,
  };

  const store=new MemoryEvidenceStore();
  store.lifecycle={integrationId:integration.id,displayName:integration.name,lifecycleStatus:"ACTIVE"};
  store.contracts=[purposeContractEvidence({
    contractId:"test-purpose",
    integrationId:integration.id,
    version:"1",
    purpose:"Process a synthetic event",
    resources:["events"],
    fields:["event.name"],
    operations:["send"],
    validTriggers:["event.created"],
    environment:"production",
    validFrom:"2026-01-01T00:00:00.000Z",
    reviewAt:"2027-01-01T00:00:00.000Z",
    expiresAt:null,
    owner:"test",
    approvedBy:"test-merchant",
    changeReason:"gateway test",
  },"gateway-test")];

  let count=0;
  const fetchImpl:typeof fetch=async()=>{
    count+=1;
    if(throwNetwork) throw new Error("synthetic network failure");
    return new Response(JSON.stringify({ok:status<400}),{
      status,
      headers:{"content-type":"application/json","x-secret-upstream":"must-not-pass"},
    });
  };

  const baseDeps={
    store,
    fetchImpl,
    env:{},
    resolveIntegration:()=>integration,
    resolveAddresses:async()=>["8.8.8.8"],
  };

  const run=(body:unknown,index=0)=>executeGatewayRequest({
    ...request(),
    requestId:"gateway-test-"+index+"-"+Math.random().toString(36).slice(2),
    body,
  },baseDeps);

  const runRaw=(body:string,contentType="application/json")=>executeGatewayRequest({
    ...request(),
    requestId:"gateway-raw-"+Math.random().toString(36).slice(2),
    body,
    contentType,
  },baseDeps);

  return {integration,store,run,runRaw,calls:()=>count};
}

function request(){
  return {
    requestId:"gateway-test",
    integrationId:"test-integration",
    environment:"production",
    method:"POST",
    path:"/v1/events",
    contentType:"application/json",
    headers:{"content-type":"application/json"},
    body:{event:{name:"purchase"}},
    observedAt,
    context:{
      businessEvent:{id:"event-"+Math.random().toString(36).slice(2),type:"event.created",timestamp:observedAt},
    },
  } as const;
}
