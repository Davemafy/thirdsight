import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { managedIngest } from "../lib/managed-ingest";
import { listDeliveries } from "../lib/store";

const token="managed-token-12345678901234567890";

beforeEach(()=>{
  process.env.PARTNER_MANAGED_TOKEN=token;
  delete process.env.DATABASE_URL;
  (globalThis as any).__partnerDeliveries=[];
  (globalThis as any).__partnerReplay=new Set();
});

describe("generic managed receiver",()=>{
  it("rejects invalid gateway auth",async()=>{
    const response=await managedIngest("managed-analytics",request("req-managed-1",{product:{id:"A"}},false));
    expect(response.status).toBe(401);
  });

  it("records nested analytics fields and proves an unexpected phone if one reaches the receiver",async()=>{
    const response=await managedIngest("managed-analytics",request("req-managed-2",{
      product:{id:"A",price:100},
      customer:{phone:"+2348000000000"},
    }));
    expect(response.status).toBe(202);
    const body=await response.json();
    expect(body.forbiddenFieldReceived).toBe(true);
    expect(body.receivedFields).toContain("customer.phone");
    const [delivery]=await listDeliveries("managed-analytics");
    expect(delivery.integrationId).toBe("cedar-analytics");
  });

  it("accepts the same phone field for the delivery receiver without calling it forbidden",async()=>{
    const response=await managedIngest("managed-delivery",request("req-managed-3",{
      order:{id:"CDR-1"},
      customer:{phone:"+2348000000000"},
      delivery:{city:"Abuja"},
    }));
    expect(response.status).toBe(202);
    const body=await response.json();
    expect(body.forbiddenFieldReceived).toBe(false);
    expect(body.receivedFields).toContain("customer.phone");
  });

  it("prevents replay by ThirdSight request id",async()=>{
    expect((await managedIngest("managed-analytics",request("req-managed-4",{product:{id:"A"}}))).status).toBe(202);
    expect((await managedIngest("managed-analytics",request("req-managed-4",{product:{id:"A"}}))).status).toBe(409);
  });
});

function request(id:string,payload:Record<string,unknown>,valid=true){
  return new NextRequest("http://partner.test/ingest/managed/analytics",{
    method:"POST",
    headers:{
      "content-type":"application/json",
      authorization:`Bearer ${valid?token:"wrong-token-1234567890"}`,
      "x-thirdsight-request-id":id,
    },
    body:JSON.stringify(payload),
  });
}
