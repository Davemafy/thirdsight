import { describe, expect, it, vi } from "vitest";
import { MerchantControlPlaneStore, hashApiKey } from "./control-plane-store.js";

describe("MerchantControlPlaneStore",()=>{
  it("returns a raw merchant key once while persisting only its hash and display metadata",async()=>{
    let persisted:Record<string,unknown>|null=null;
    const fetchImpl=vi.fn(async (_url:URL|RequestInfo,init?:RequestInit)=>{
      persisted=JSON.parse(String(init?.body)) as Record<string,unknown>;
      return new Response(JSON.stringify([{
        key_id:"key-1",
        merchant_id:"merchant-1",
        key_prefix:String(persisted.key_prefix),
        key_last_four:String(persisted.key_last_four),
        label:"CEDAR Analytics managed gateway",
        created_at:"2026-09-21T20:00:00.000Z",
        last_used_at:null,
        revoked_at:null,
      }]),{status:201,headers:{"content-type":"application/json"}});
    });
    const store=new MerchantControlPlaneStore({projectUrl:"https://example.supabase.co",serviceRoleKey:"service-role",fetchImpl:fetchImpl as typeof fetch});
    const created=await store.createApiKey({merchantId:"merchant-1",label:"CEDAR Analytics managed gateway"});

    expect(created.rawKey).toMatch(/^ts_live_/);
    expect(persisted).not.toBeNull();
    expect(persisted).not.toHaveProperty("rawKey");
    expect(persisted).not.toHaveProperty("api_key");
    expect(persisted?.key_hash).toBe(hashApiKey(created.rawKey));
    expect(String(persisted?.key_hash)).not.toContain(created.rawKey);
  });

  it("checks the merchant installation independently of the API key",async()=>{
    const urls:string[]=[];
    const fetchImpl=vi.fn(async (input:URL|RequestInfo)=>{
      urls.push(String(input));
      return new Response(JSON.stringify([{merchant_integration_id:"install-1"}]),{status:200,headers:{"content-type":"application/json"}});
    });
    const store=new MerchantControlPlaneStore({projectUrl:"https://example.supabase.co",serviceRoleKey:"service-role",fetchImpl:fetchImpl as typeof fetch});

    await expect(store.hasActiveIntegration("merchant-1","cedar-analytics","synthetic-demo")).resolves.toBe(true);
    const url=new URL(urls[0]);
    expect(url.searchParams.get("merchant_id")).toBe("eq.merchant-1");
    expect(url.searchParams.get("integration_id")).toBe("eq.cedar-analytics");
    expect(url.searchParams.get("lifecycle_status")).toBe("eq.ACTIVE");
    expect(url.searchParams.get("environment")).toBe("eq.synthetic-demo");
  });
});