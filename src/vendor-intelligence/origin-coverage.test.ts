import { describe, expect, it } from "vitest";
import {
  enrichOriginCoverage,
  summarizeOriginCoverage,
  type BenchmarkOriginInventoryEntry,
} from "./origin-coverage";

const row=(partial:Partial<BenchmarkOriginInventoryEntry>):BenchmarkOriginInventoryEntry=>({
  coverageState:"INDEXED",
  origin:"https://unknown.example",
  hostname:"unknown.example",
  siteCount:1,
  sourceNamespaceSiteCount:0,
  externalSiteCount:1,
  relationshipClass:"SINGLE_EXTERNAL",
  exampleSites:["merchant.example"],
  ...partial,
});

describe("origin coverage",()=>{
  it("separates full inventory coverage from documentation resolution",()=>{
    const known=enrichOriginCoverage(row({
      origin:"https://www.googletagmanager.com",
      hostname:"www.googletagmanager.com",
      siteCount:10,
    }));
    const unknown=enrichOriginCoverage(row({origin:"https://foo-cdn.example"}));

    expect(known.disposition).toBe("DOCUMENTED_PRODUCT_FAMILY");
    expect(unknown.disposition).toBe("INDEXED_SINGLE_EXTERNAL");
    expect(unknown.vendorIntelligence.status).toBe("UNRESOLVED");
  });

  it("retains source-namespace and shared-external distinctions for unresolved origins",()=>{
    expect(enrichOriginCoverage(row({
      origin:"https://static.shop.example",
      hostname:"static.shop.example",
      sourceNamespaceSiteCount:1,
      externalSiteCount:0,
      relationshipClass:"SOURCE_NAMESPACE_ONLY",
    })).disposition).toBe("INDEXED_SOURCE_NAMESPACE");

    expect(enrichOriginCoverage(row({
      siteCount:7,
      externalSiteCount:7,
      relationshipClass:"SHARED_EXTERNAL",
    })).disposition).toBe("INDEXED_SHARED_EXTERNAL");
  });

  it("reports documentation coverage separately from 100 percent indexing",()=>{
    const summary=summarizeOriginCoverage([
      row({origin:"https://www.googletagmanager.com",hostname:"www.googletagmanager.com",siteCount:10}),
      row({origin:"https://foo-cdn.example",siteCount:2,relationshipClass:"SHARED_EXTERNAL",externalSiteCount:2}),
    ]);

    expect(summary.indexed).toBe(2);
    expect(summary.documentedProductFamily).toBe(1);
    expect(summary.documentationCoveragePct).toBe(50);
    expect(summary.weightedDocumentationCoveragePct).toBe(83.33);
  });
});
