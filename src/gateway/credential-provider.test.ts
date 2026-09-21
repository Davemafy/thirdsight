import { describe, expect, it } from "vitest";
import { applyCredential } from "./credential-provider.js";

describe("credential custody",()=>{
  it("injects bearer credentials after policy without mutating the merchant payload",()=>{
    const original={amount:1000};
    const result=applyCredential({
      spec:{kind:"BEARER",env:"PAYSTACK_SECRET_KEY"},
      env:{PAYSTACK_SECRET_KEY:"sk_test_secret"},
      url:new URL("https://api.paystack.co/transaction/initialize"),
      headers:new Headers({"content-type":"application/json"}),
      body:original,
    });
    expect(result.headers.get("authorization")).toBe("Bearer sk_test_secret");
    expect(original).toEqual({amount:1000});
  });

  it("can inject body and query credentials without exposing them in the original object",()=>{
    const original={to:"2348000000000"};
    const bodyResult=applyCredential({
      spec:{kind:"BODY_FIELD",env:"TERMII_API_KEY",field:"api_key"},env:{TERMII_API_KEY:"termii-secret"},
      url:new URL("https://api.ng.termii.com/api/sms/send"),headers:new Headers(),body:original,
    });
    expect(bodyResult.body.api_key).toBe("termii-secret");
    expect(original).not.toHaveProperty("api_key");

    const queryResult=applyCredential({
      spec:{kind:"QUERY_PARAM",env:"GA4_API_SECRET",param:"api_secret"},env:{GA4_API_SECRET:"ga-secret"},
      url:new URL("https://www.google-analytics.com/mp/collect?measurement_id=G-TEST"),headers:new Headers(),body:{client_id:"x"},
    });
    expect(queryResult.url.searchParams.get("api_secret")).toBe("ga-secret");
  });
});
