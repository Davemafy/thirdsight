import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetMemoryForTests } from "../../lib/commerce-store";
import { emitCheckoutCompleted } from "../../lib/integration";
import type { Order } from "../../lib/types";

const order:Order={
  id:"11111111-2222-4333-8444-555555555555",
  orderNumber:"CDR-2026-DEMO01",
  status:"CONFIRMED",
  paymentStatus:"SYNTHETIC_AUTHORIZED",
  email:"ada@example.test",
  phone:"+2348000000000",
  deliveryAddress:{firstName:"Ada",lastName:"Example",line1:"12 Demo Crescent",line2:"",city:"Abuja",state:"FCT",country:"Nigeria"},
  deliveryMethod:"STANDARD",
  paymentMethod:"TEST_VISA_4242",
  subtotal:189900,
  discount:0,
  delivery:0,
  total:189900,
  createdAt:"2026-09-21T12:00:00.000Z",
  estimatedDelivery:"2026-09-24T12:00:00.000Z",
  lines:[{id:"line-1",productName:"Auralite H3",variantLabel:"Midnight",sku:"AH-H3-MID",quantity:1,unitPrice:189900,imageUrl:"/products/auralite-h3-1.webp"}],
};

beforeEach(()=>{
  delete process.env.DATABASE_URL;
  process.env.THIRDSIGHT_MANAGED_GATEWAY_URL="https://thirdsight.example/api/managed-gateway";
  process.env.THIRDSIGHT_GATEWAY_API_KEY="merchant-gateway-key-1234567890";
  __resetMemoryForTests();
});

afterEach(()=>{
  vi.unstubAllGlobals();
  delete process.env.THIRDSIGHT_MANAGED_GATEWAY_URL;
  delete process.env.THIRDSIGHT_GATEWAY_API_KEY;
});

describe("CEDAR managed ThirdSight integration",()=>{
  it("routes analytics and delivery through the generic gateway with the same customer phone under different integration policies",async()=>{
    const calls:Array<{url:URL;body:any;context:any}>=[];
    vi.stubGlobal("fetch",async(input:URL|string|Request,init?:RequestInit)=>{
      const url=new URL(typeof input==="string"?input:input instanceof URL?input.toString():input.url);
      const body=JSON.parse(String(init?.body??"{}"));
      const headers=new Headers(init?.headers);
      const context=JSON.parse(headers.get("x-thirdsight-context")??"{}");
      calls.push({url,body,context});
      const analytics=url.searchParams.get("integration")==="cedar-analytics";
      return new Response(JSON.stringify({
        receivedFields:analytics
          ?["order.id","order.value","product.id","product.category","product.price"]
          :["order.id","customer.phone","delivery.address","delivery.city","delivery.state","items[].sku","items[].quantity"],
        forbiddenFieldReceived:false,
      }),{
        status:202,
        headers:{
          "content-type":"application/json",
          "x-thirdsight-decision":analytics?"CONSTRAIN":"ALLOW",
          "x-thirdsight-request-id":analytics?"evidence-analytics":"evidence-delivery",
        },
      });
    });

    const result=await emitCheckoutCompleted(order);
    expect(result?.evidenceId).toBe("evidence-analytics");
    expect(result?.deliveryEvidenceId).toBe("evidence-delivery");
    expect(calls).toHaveLength(2);

    const analytics=calls.find((call)=>call.url.searchParams.get("integration")==="cedar-analytics")!;
    const delivery=calls.find((call)=>call.url.searchParams.get("integration")==="cedar-delivery")!;

    expect(analytics.body.customer.phone).toBe(order.phone);
    expect(delivery.body.customer.phone).toBe(order.phone);
    expect(analytics.context.requestRefs.orderRefHash).toBe(delivery.context.requestRefs.orderRefHash);
    expect(analytics.url.pathname).toBe("/api/managed-gateway");
    expect(delivery.url.pathname).toBe("/api/managed-gateway");
  });
});
