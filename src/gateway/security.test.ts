import { describe, expect, it } from "vitest";
import { assertResolvedAddressesPublic, filterClientHeaders, resolveSafeUpstream, validateConfiguredOrigin } from "./security.js";
import type { GatewayIntegration } from "./gateway-types.js";

const integration:GatewayIntegration={
  id:"test",name:"Test",environment:"production",upstreamOrigin:"https://api.example.com",
  allowedRoutes:[{method:"POST",path:"/v1/events"}],allowedContentTypes:["application/json"],
  auth:{kind:"NONE"},failureMode:"CLOSED",unsupportedPayloadMode:"BLOCK",timeoutMs:1000,maxBodyBytes:1000,
  compatibilityStatus:"CONTROLLED_RECEIVER",documentationUrl:"https://example.com",
};

describe("gateway security",()=>{
  it("allows only registered methods and paths",()=>{
    expect(resolveSafeUpstream(integration,"/v1/events","POST").url.toString()).toBe("https://api.example.com/v1/events");
    expect(()=>resolveSafeUpstream(integration,"/v1/other","POST")).toThrow();
    expect(()=>resolveSafeUpstream(integration,"/v1/events","DELETE")).toThrow();
  });

  it("rejects origin escape and encoded path-separator attempts",()=>{
    expect(()=>resolveSafeUpstream(integration,"//evil.example/events","POST")).toThrow();
    expect(()=>resolveSafeUpstream({...integration,allowedRoutes:[{method:"POST",path:"/v1/:id"}]},"/v1/a%2Fb","POST")).toThrow();
  });

  it("rejects private, local and non-HTTPS configured origins",()=>{
    expect(()=>validateConfiguredOrigin("http://api.example.com")).toThrow();
    expect(()=>validateConfiguredOrigin("https://127.0.0.1")).toThrow();
    expect(()=>validateConfiguredOrigin("https://169.254.169.254")).toThrow();
    expect(()=>validateConfiguredOrigin("https://10.0.0.1")).toThrow();
  });

  it("rejects a registered hostname when DNS resolves to a private target",()=>{
    expect(()=>assertResolvedAddressesPublic(["10.0.0.8"])).toThrow();
    expect(()=>assertResolvedAddressesPublic(["169.254.169.254"])).toThrow();
    expect(()=>assertResolvedAddressesPublic(["::1"])).toThrow();
    expect(()=>assertResolvedAddressesPublic(["8.8.8.8"])).not.toThrow();
  });

  it("strips caller credentials, cookies and hop-by-hop headers",()=>{
    const filtered=filterClientHeaders({
      authorization:"Bearer merchant-secret",cookie:"sid=1",host:"evil.example",connection:"keep-alive",
      "content-type":"application/json","idempotency-key":"idem-1",
    });
    expect(filtered.has("authorization")).toBe(false);
    expect(filtered.has("cookie")).toBe(false);
    expect(filtered.has("host")).toBe(false);
    expect(filtered.get("content-type")).toBe("application/json");
    expect(filtered.get("idempotency-key")).toBe("idem-1");
  });
});
