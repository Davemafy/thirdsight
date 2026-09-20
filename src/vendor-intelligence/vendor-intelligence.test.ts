import { describe, expect, it } from "vitest";
import {
  VENDOR_INTELLIGENCE_VERSION,
  resolveVendorIntelligence,
  resolveVendorOrigin,
} from "./vendor-intelligence";

describe("vendor intelligence registry",()=>{
  it("resolves Google Tag Manager infrastructure without pretending it is merchant approval",()=>{
    const result=resolveVendorOrigin("https://www.googletagmanager.com");
    expect(result.status).toBe("MATCHED");
    expect(result.registryVersion).toBe(VENDOR_INTELLIGENCE_VERSION);
    expect(result.profiles[0]?.profileId).toBe("google-tagging");
    expect(result.authorityBoundary).toContain("does not establish merchant approval");
  });

  it("recognizes common vendor families from the public benchmark",()=>{
    expect(resolveVendorOrigin("https://connect.facebook.net").profiles[0]?.vendor).toBe("Meta");
    expect(resolveVendorOrigin("https://static.cloudflareinsights.com").profiles[0]?.family).toBe("Cloudflare Web Analytics");
    expect(resolveVendorOrigin("https://cdn.cookielaw.org").profiles[0]?.vendor).toBe("OneTrust");
    expect(resolveVendorOrigin("https://www.clarity.ms").profiles[0]?.vendor).toBe("Microsoft");
    expect(resolveVendorOrigin("https://securepubads.g.doubleclick.net").profiles[0]?.family).toBe("Google Publisher Tag / Ad Manager");
  });

  it("keeps unknown domains unresolved",()=>{
    const result=resolveVendorOrigin("https://foo-cdn.example");
    expect(result.status).toBe("UNRESOLVED");
    expect(result.profiles).toEqual([]);
    expect(result.unresolvedOrigins).toEqual(["https://foo-cdn.example"]);
  });

  it("can represent multiple documented vendor families without collapsing them",()=>{
    const result=resolveVendorIntelligence([
      "https://www.googletagmanager.com",
      "https://connect.facebook.net",
    ]);
    expect(result.status).toBe("MULTIPLE");
    expect(result.profiles.map(profile=>profile.vendor).sort()).toEqual(["Google","Meta"]);
  });
});
