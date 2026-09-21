import { describe, expect, it } from "vitest";
import { ThirdSight } from "./client.js";

describe("ThirdSight thin client",()=>{
  it("addresses the gateway by registered integration id and relative path",async()=>{
    let seen:Request|null=null;
    const client=new ThirdSight({
      baseUrl:"https://thirdsight.example",
      apiKey:"merchant-gateway-key-123456",
      environment:"production",
      fetchImpl:async(input,init)=>{
        seen=new Request(input,init);
        return new Response("ok",{status:200});
      },
    });

    await client.integration("paystack").fetch("/transaction/initialize",{
      method:"POST",
      body:{email:"ada@example.test",amount:1000},
      context:{businessEvent:{id:"checkout-1",type:"checkout.started"}},
    });

    expect(seen).not.toBeNull();
    const url=new URL(seen!.url);
    expect(url.pathname).toBe("/api/managed-gateway");
    expect(url.searchParams.get("integration")).toBe("paystack");
    expect(url.searchParams.get("path")).toBe("/transaction/initialize");
    expect(url.searchParams.has("url")).toBe(false);
    expect(seen!.headers.get("authorization")).toBe("Bearer merchant-gateway-key-123456");
    expect(seen!.headers.get("x-thirdsight-context")).toContain("checkout.started");
  });

  it("rejects non-HTTPS remote gateway origins",()=>{
    expect(()=>new ThirdSight({baseUrl:"http://example.com",apiKey:"merchant-gateway-key-123456"})).toThrow();
  });

  it("wrapFetch remains a thin alias over the same gateway request",async()=>{
    let calls=0;
    const client=new ThirdSight({
      baseUrl:"https://thirdsight.example",
      apiKey:"merchant-gateway-key-123456",
      fetchImpl:async()=>{calls+=1;return new Response("ok");},
    });
    const protectedFetch=client.wrapFetch("ga4");
    await protectedFetch("/mp/collect?measurement_id=G-DEMO",{method:"POST",body:{client_id:"demo"}});
    expect(calls).toBe(1);
  });
});
