import {
  resolveVendorOrigin,
  type VendorIntelligenceResolution,
} from "./vendor-intelligence";

export type OriginRelationshipClass =
  | "SOURCE_NAMESPACE_ONLY"
  | "MIXED_SOURCE_AND_EXTERNAL"
  | "SHARED_EXTERNAL"
  | "SINGLE_EXTERNAL";

export interface BenchmarkOriginInventoryEntry {
  coverageState:"INDEXED";
  origin:string;
  hostname:string;
  siteCount:number;
  sourceNamespaceSiteCount:number;
  externalSiteCount:number;
  relationshipClass:OriginRelationshipClass;
  exampleSites:readonly string[];
}

export interface BenchmarkOriginInventory {
  schemaVersion:"thirdsight-global1000-origin-inventory.v1";
  generatedAt:string;
  benchmark:{
    runId:string;
    source:{
      name:string;
      url:string;
      version:string;
      selectedRange:string;
      selectedSha256:string;
    };
    mode:string;
    sitesAttempted:number;
    uniqueObservedCrossOriginOrigins:number;
  };
  semantics:{
    coverage:string;
    sourceNamespace:string;
    external:string;
    documentation:string;
  };
  inventorySha256:string;
  entries:readonly BenchmarkOriginInventoryEntry[];
}

export type OriginIntelligenceDisposition =
  | "DOCUMENTED_PRODUCT_FAMILY"
  | "INDEXED_SOURCE_NAMESPACE"
  | "INDEXED_SHARED_EXTERNAL"
  | "INDEXED_SINGLE_EXTERNAL"
  | "INDEXED_MIXED_RELATIONSHIP";

export interface EnrichedOriginCoverage extends BenchmarkOriginInventoryEntry {
  disposition:OriginIntelligenceDisposition;
  vendorIntelligence:VendorIntelligenceResolution;
}

export interface OriginCoverageSummary {
  indexed:number;
  documentedProductFamily:number;
  indexedWithoutProductDocs:number;
  documentationCoveragePct:number;
  siteOriginObservations:number;
  documentedSiteOriginObservations:number;
  weightedDocumentationCoveragePct:number;
  byDisposition:Record<OriginIntelligenceDisposition,number>;
}

export function enrichOriginCoverage(entry:BenchmarkOriginInventoryEntry):EnrichedOriginCoverage{
  const vendorIntelligence=resolveVendorOrigin(entry.origin);
  const disposition:OriginIntelligenceDisposition=
    vendorIntelligence.status!=="UNRESOLVED"
      ?"DOCUMENTED_PRODUCT_FAMILY"
      :entry.relationshipClass==="SOURCE_NAMESPACE_ONLY"
        ?"INDEXED_SOURCE_NAMESPACE"
        :entry.relationshipClass==="SHARED_EXTERNAL"
          ?"INDEXED_SHARED_EXTERNAL"
          :entry.relationshipClass==="MIXED_SOURCE_AND_EXTERNAL"
            ?"INDEXED_MIXED_RELATIONSHIP"
            :"INDEXED_SINGLE_EXTERNAL";

  return {...entry,disposition,vendorIntelligence};
}

export function summarizeOriginCoverage(entries:readonly BenchmarkOriginInventoryEntry[]):OriginCoverageSummary{
  const enriched=entries.map(enrichOriginCoverage);
  const documented=enriched.filter(row=>row.disposition==="DOCUMENTED_PRODUCT_FAMILY");
  const siteOriginObservations=enriched.reduce((sum,row)=>sum+row.siteCount,0);
  const documentedSiteOriginObservations=documented.reduce((sum,row)=>sum+row.siteCount,0);
  const byDisposition={
    DOCUMENTED_PRODUCT_FAMILY:0,
    INDEXED_SOURCE_NAMESPACE:0,
    INDEXED_SHARED_EXTERNAL:0,
    INDEXED_SINGLE_EXTERNAL:0,
    INDEXED_MIXED_RELATIONSHIP:0,
  } satisfies Record<OriginIntelligenceDisposition,number>;

  for(const row of enriched) byDisposition[row.disposition]+=1;

  return {
    indexed:enriched.length,
    documentedProductFamily:documented.length,
    indexedWithoutProductDocs:enriched.length-documented.length,
    documentationCoveragePct:enriched.length===0?0:Number(((documented.length/enriched.length)*100).toFixed(2)),
    siteOriginObservations,
    documentedSiteOriginObservations,
    weightedDocumentationCoveragePct:siteOriginObservations===0?0:Number(((documentedSiteOriginObservations/siteOriginObservations)*100).toFixed(2)),
    byDisposition,
  };
}
