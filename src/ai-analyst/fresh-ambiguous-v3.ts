import type { BrowserObservationV1 } from "../infrastructure/browser-evidence/browser-evidence-adapter.js";
import type { EvidenceGraphRecord } from "../domain/evidence.js";
import {
  decideVerification,
  verifyShadowIntegration,
  type VerificationFinding,
} from "../domain/deterministic-verifier.js";
import type { IntegrationResolutionResult } from "../domain/integration-identity.js";
import type { AmbiguousBenchmarkCase } from "./held-out-ambiguous.js";

interface Spec {
  caseId: string;
  family: string;
  integrationId: string | null;
  integrationResolution: "RESOLVED" | "UNRESOLVED";
  pageOrigin: string;
  destinationOrigin: string;
  destinationPath: string;
  originRelationship: "SAME_ORIGIN" | "CROSS_ORIGIN" | "UNKNOWN";
  method: "GET" | "POST";
  resourceType: "Fetch" | "Script" | "Image";
  should: "KNOWN" | "UNKNOWN" | "PARTIAL";
  could: "PARTIAL" | "UNKNOWN";
  why: "KNOWN" | "PARTIAL" | "UNKNOWN";
  coverageLabel: "BROWSER_ONLY" | "MULTI_BOUNDARY";
  managedEnvironment: boolean;
  inventoryComplete: boolean;
  expectedRecommendations: readonly ("OBSERVE" | "REVIEW" | "ABSTAIN")[];
  usefulReview: boolean;
  shouldAbstain: boolean;
  dataCategories?: readonly string[];
  eventType?: string;
}

const BASE_TIME = Date.parse("2026-09-18T18:10:00.000Z");
export const FRESH_AMBIGUOUS_BENCHMARK_V3_ID = "stage8-fresh-v3";

export function buildFreshAmbiguousCasesV3(): AmbiguousBenchmarkCase[] {
  const specs: Spec[] = [
    {
      caseId:"v3-public-checkout-beacon",family:"public-cross-origin-business-unknown",
      integrationId:null,integrationResolution:"UNRESOLVED",
      pageOrigin:"https://public-store.example",destinationOrigin:"https://events.edge-observe.example",destinationPath:"/checkout/event",
      originRelationship:"CROSS_ORIGIN",method:"POST",resourceType:"Fetch",
      should:"UNKNOWN",could:"PARTIAL",why:"UNKNOWN",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:false,inventoryComplete:false,
      expectedRecommendations:["OBSERVE"],usefulReview:true,shouldAbstain:false
    },
    {
      caseId:"v3-managed-unknown-script",family:"managed-shadow-script",
      integrationId:null,integrationResolution:"UNRESOLVED",
      pageOrigin:"https://managed-shop.example",destinationOrigin:"https://tag-new.example",destinationPath:"/commerce.js",
      originRelationship:"CROSS_ORIGIN",method:"GET",resourceType:"Script",
      should:"UNKNOWN",could:"PARTIAL",why:"UNKNOWN",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:true,inventoryComplete:true,
      expectedRecommendations:["REVIEW","OBSERVE"],usefulReview:true,shouldAbstain:false
    },
    {
      caseId:"v3-contract-no-business-event",family:"known-purpose-missing-why",
      integrationId:"recommendation-partner",integrationResolution:"RESOLVED",
      pageOrigin:"https://managed-shop.example",destinationOrigin:"https://recommend-v3.example",destinationPath:"/event",
      originRelationship:"CROSS_ORIGIN",method:"POST",resourceType:"Fetch",
      should:"KNOWN",could:"PARTIAL",why:"UNKNOWN",coverageLabel:"MULTI_BOUNDARY",
      managedEnvironment:true,inventoryComplete:true,
      expectedRecommendations:["REVIEW"],usefulReview:true,shouldAbstain:false,
      dataCategories:["product.id","product.category"]
    },
    {
      caseId:"v3-weak-trigger-window",family:"weak-business-correlation",
      integrationId:"recommendation-partner",integrationResolution:"RESOLVED",
      pageOrigin:"https://managed-shop.example",destinationOrigin:"https://recommend-v3.example",destinationPath:"/batch",
      originRelationship:"CROSS_ORIGIN",method:"POST",resourceType:"Fetch",
      should:"KNOWN",could:"PARTIAL",why:"PARTIAL",coverageLabel:"MULTI_BOUNDARY",
      managedEnvironment:true,inventoryComplete:true,
      expectedRecommendations:["REVIEW","OBSERVE"],usefulReview:true,shouldAbstain:false,
      dataCategories:["product.id"]
    },
    {
      caseId:"v3-event-but-no-contract",family:"missing-purpose-contract",
      integrationId:"recommendation-partner",integrationResolution:"RESOLVED",
      pageOrigin:"https://managed-shop.example",destinationOrigin:"https://recommend-v3.example",destinationPath:"/context",
      originRelationship:"CROSS_ORIGIN",method:"POST",resourceType:"Fetch",
      should:"UNKNOWN",could:"PARTIAL",why:"KNOWN",coverageLabel:"MULTI_BOUNDARY",
      managedEnvironment:true,inventoryComplete:true,
      expectedRecommendations:["REVIEW"],usefulReview:true,shouldAbstain:false,
      dataCategories:["product.id"]
    },
    {
      caseId:"v3-partial-purpose",family:"partial-purpose-evidence",
      integrationId:"recommendation-partner",integrationResolution:"RESOLVED",
      pageOrigin:"https://managed-shop.example",destinationOrigin:"https://recommend-v3.example",destinationPath:"/loyalty",
      originRelationship:"CROSS_ORIGIN",method:"POST",resourceType:"Fetch",
      should:"PARTIAL",could:"PARTIAL",why:"KNOWN",coverageLabel:"MULTI_BOUNDARY",
      managedEnvironment:true,inventoryComplete:true,
      expectedRecommendations:["REVIEW"],usefulReview:true,shouldAbstain:false,
      dataCategories:["customer.loyalty_tier"]
    },
    {
      caseId:"v3-known-context-opaque-body",family:"opaque-browser-payload",
      integrationId:"recommendation-partner",integrationResolution:"RESOLVED",
      pageOrigin:"https://managed-shop.example",destinationOrigin:"https://recommend-v3.example",destinationPath:"/opaque",
      originRelationship:"CROSS_ORIGIN",method:"POST",resourceType:"Fetch",
      should:"KNOWN",could:"PARTIAL",why:"KNOWN",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:true,inventoryComplete:true,
      expectedRecommendations:["OBSERVE","REVIEW"],usefulReview:true,shouldAbstain:false
    },
    {
      caseId:"v3-origin-relationship-unknown",family:"origin-relationship-unknown",
      integrationId:null,integrationResolution:"UNRESOLVED",
      pageOrigin:"https://managed-shop.example",destinationOrigin:"https://edge-signals.example",destinationPath:"/signal",
      originRelationship:"UNKNOWN",method:"POST",resourceType:"Fetch",
      should:"UNKNOWN",could:"PARTIAL",why:"UNKNOWN",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:true,inventoryComplete:true,
      expectedRecommendations:["REVIEW","OBSERVE"],usefulReview:true,shouldAbstain:false
    },
    {
      caseId:"v3-approved-object-match",family:"known-purpose-known-why",
      integrationId:"recommendation-partner",integrationResolution:"RESOLVED",
      pageOrigin:"https://managed-shop.example",destinationOrigin:"https://recommend-v3.example",destinationPath:"/view",
      originRelationship:"CROSS_ORIGIN",method:"POST",resourceType:"Fetch",
      should:"KNOWN",could:"PARTIAL",why:"KNOWN",coverageLabel:"MULTI_BOUNDARY",
      managedEnvironment:true,inventoryComplete:true,
      expectedRecommendations:["OBSERVE"],usefulReview:true,shouldAbstain:false,
      dataCategories:["product.id","product.category"]
    },
    {
      caseId:"v3-public-tag-loader",family:"public-cross-origin-script",
      integrationId:null,integrationResolution:"UNRESOLVED",
      pageOrigin:"https://public-store.example",destinationOrigin:"https://tags-observe.example",destinationPath:"/loader.js",
      originRelationship:"CROSS_ORIGIN",method:"GET",resourceType:"Script",
      should:"UNKNOWN",could:"PARTIAL",why:"UNKNOWN",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:false,inventoryComplete:false,
      expectedRecommendations:["OBSERVE"],usefulReview:true,shouldAbstain:false
    },
    {
      caseId:"v3-managed-new-metrics-endpoint",family:"managed-new-destination",
      integrationId:null,integrationResolution:"UNRESOLVED",
      pageOrigin:"https://managed-shop.example",destinationOrigin:"https://metrics-v3-new.example",destinationPath:"/v2/cart",
      originRelationship:"CROSS_ORIGIN",method:"POST",resourceType:"Fetch",
      should:"UNKNOWN",could:"PARTIAL",why:"PARTIAL",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:true,inventoryComplete:true,
      expectedRecommendations:["REVIEW","OBSERVE"],usefulReview:true,shouldAbstain:false,
      eventType:"cart.updated"
    },
    {
      caseId:"v3-approved-empty-categories",family:"known-context-no-visible-categories",
      integrationId:"recommendation-partner",integrationResolution:"RESOLVED",
      pageOrigin:"https://managed-shop.example",destinationOrigin:"https://recommend-v3.example",destinationPath:"/summary",
      originRelationship:"CROSS_ORIGIN",method:"POST",resourceType:"Fetch",
      should:"KNOWN",could:"PARTIAL",why:"KNOWN",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:true,inventoryComplete:true,
      expectedRecommendations:["OBSERVE","REVIEW"],usefulReview:true,shouldAbstain:false
    },
    {
      caseId:"v3-same-origin-app-script",family:"irrelevant-first-party-static",
      integrationId:null,integrationResolution:"UNRESOLVED",
      pageOrigin:"https://managed-shop.example",destinationOrigin:"https://managed-shop.example",destinationPath:"/assets/checkout.7aa1.js",
      originRelationship:"SAME_ORIGIN",method:"GET",resourceType:"Script",
      should:"UNKNOWN",could:"UNKNOWN",why:"UNKNOWN",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:true,inventoryComplete:true,
      expectedRecommendations:["ABSTAIN"],usefulReview:false,shouldAbstain:true
    },
    {
      caseId:"v3-same-origin-health",family:"irrelevant-first-party-health",
      integrationId:null,integrationResolution:"UNRESOLVED",
      pageOrigin:"https://managed-shop.example",destinationOrigin:"https://managed-shop.example",destinationPath:"/healthz",
      originRelationship:"SAME_ORIGIN",method:"GET",resourceType:"Fetch",
      should:"UNKNOWN",could:"PARTIAL",why:"UNKNOWN",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:true,inventoryComplete:true,
      expectedRecommendations:["ABSTAIN"],usefulReview:false,shouldAbstain:true
    },
    {
      caseId:"v3-public-font",family:"public-static-font",
      integrationId:null,integrationResolution:"UNRESOLVED",
      pageOrigin:"https://public-store.example",destinationOrigin:"https://cdn-static.example",destinationPath:"/fonts/ui.woff2",
      originRelationship:"CROSS_ORIGIN",method:"GET",resourceType:"Fetch",
      should:"UNKNOWN",could:"PARTIAL",why:"UNKNOWN",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:false,inventoryComplete:false,
      expectedRecommendations:["ABSTAIN"],usefulReview:false,shouldAbstain:true
    },
    {
      caseId:"v3-public-product-image",family:"public-static-image",
      integrationId:null,integrationResolution:"UNRESOLVED",
      pageOrigin:"https://public-store.example",destinationOrigin:"https://images-static.example",destinationPath:"/products/sku-42.webp",
      originRelationship:"CROSS_ORIGIN",method:"GET",resourceType:"Image",
      should:"UNKNOWN",could:"PARTIAL",why:"UNKNOWN",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:false,inventoryComplete:false,
      expectedRecommendations:["ABSTAIN"],usefulReview:false,shouldAbstain:true
    },
    {
      caseId:"v3-same-origin-prefetch",family:"irrelevant-first-party-prefetch",
      integrationId:null,integrationResolution:"UNRESOLVED",
      pageOrigin:"https://managed-shop.example",destinationOrigin:"https://managed-shop.example",destinationPath:"/api/catalog/prefetch",
      originRelationship:"SAME_ORIGIN",method:"GET",resourceType:"Fetch",
      should:"UNKNOWN",could:"UNKNOWN",why:"UNKNOWN",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:true,inventoryComplete:true,
      expectedRecommendations:["ABSTAIN"],usefulReview:false,shouldAbstain:true
    },
    {
      caseId:"v3-public-favicon",family:"public-static-icon",
      integrationId:null,integrationResolution:"UNRESOLVED",
      pageOrigin:"https://public-store.example",destinationOrigin:"https://assets-static.example",destinationPath:"/favicon.ico",
      originRelationship:"CROSS_ORIGIN",method:"GET",resourceType:"Image",
      should:"UNKNOWN",could:"PARTIAL",why:"UNKNOWN",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:false,inventoryComplete:false,
      expectedRecommendations:["ABSTAIN"],usefulReview:false,shouldAbstain:true
    },
    {
      caseId:"v3-same-origin-config",family:"irrelevant-first-party-config",
      integrationId:null,integrationResolution:"UNRESOLVED",
      pageOrigin:"https://managed-shop.example",destinationOrigin:"https://managed-shop.example",destinationPath:"/config/runtime.json",
      originRelationship:"SAME_ORIGIN",method:"GET",resourceType:"Fetch",
      should:"UNKNOWN",could:"UNKNOWN",why:"UNKNOWN",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:true,inventoryComplete:true,
      expectedRecommendations:["ABSTAIN"],usefulReview:false,shouldAbstain:true
    },
    {
      caseId:"v3-public-css-asset",family:"public-static-asset",
      integrationId:null,integrationResolution:"UNRESOLVED",
      pageOrigin:"https://public-store.example",destinationOrigin:"https://cdn-static.example",destinationPath:"/styles/store.css",
      originRelationship:"CROSS_ORIGIN",method:"GET",resourceType:"Fetch",
      should:"UNKNOWN",could:"PARTIAL",why:"UNKNOWN",coverageLabel:"BROWSER_ONLY",
      managedEnvironment:false,inventoryComplete:false,
      expectedRecommendations:["ABSTAIN"],usefulReview:false,shouldAbstain:true
    }
  ];
  return specs.map((spec,index)=>buildCase(spec,index));
}

function buildCase(spec:Spec,index:number):AmbiguousBenchmarkCase{
  const observedAt=new Date(BASE_TIME+index*13_000).toISOString();
  const observation:BrowserObservationV1={
    schemaVersion:"browser-observation.v1",
    observationId:`stage8-fresh-v3-${spec.caseId}`,
    sensorId:"stage8-fresh-v3",
    observedAt,
    pageUrl:`${spec.pageOrigin}/eval-v3`,
    destinationUrl:`${spec.destinationOrigin}${spec.destinationPath}`,
    method:spec.method,
    resourceType:spec.resourceType,
    initiatorType:"script",
    hasPostData:spec.method==="POST"
  };
  const evidence=makeEvidence(spec,observedAt);
  const findings:readonly VerificationFinding[]=verifyShadowIntegration(evidence,{
    managedEnvironment:spec.managedEnvironment,
    integrationInventoryComplete:spec.inventoryComplete
  });
  const decision=decideVerification(findings);
  const resolution:IntegrationResolutionResult=
    spec.integrationResolution==="RESOLVED"&&spec.integrationId
      ?{status:"RESOLVED",integrationId:spec.integrationId,confidence:"AUTHORITATIVE",bindingIds:["stage8-fresh-v3-binding"],sourceIds:["stage8-fresh-v3-fixture"],reason:"Fresh synthetic benchmark identity is declared for evaluation."}
      :{status:"UNRESOLVED",integrationId:null,confidence:"UNKNOWN",bindingIds:[],sourceIds:[],reason:"No integration identity is supplied by this fresh benchmark case."};
  return {caseId:spec.caseId,family:spec.family,evidence,observation,findings,decision,resolution,expectedRecommendations:spec.expectedRecommendations,usefulReview:spec.usefulReview,shouldAbstain:spec.shouldAbstain};
}

function makeEvidence(spec:Spec,observedAt:string):EvidenceGraphRecord{
  const browserProvenance=[{source:"browser" as const,sourceId:`stage8-fresh-v3:${spec.caseId}`,observedAt,confidence:"OBSERVED" as const}];
  const should=spec.should==="KNOWN"
    ?{status:"KNOWN" as const,confidence:"AUTHORITATIVE" as const,value:{contractId:"recommendation-commerce-v3",contractVersion:"1",purpose:"Generate on-site recommendations from approved commerce context",resources:["recommendation.signals"],fields:["product.id","product.category","product.price","customer.loyalty_tier"],operations:["send"],validTriggers:["product.viewed","cart.updated"]},provenance:[{source:"purpose-contract" as const,sourceId:"stage8-fresh-v3:contract:v1",observedAt,confidence:"AUTHORITATIVE" as const}],reason:"An active Purpose Contract is available."}
    :{status:spec.should as "UNKNOWN"|"PARTIAL",confidence:spec.should==="PARTIAL"?"INFERRED" as const:"UNKNOWN" as const,value:null,provenance:[],reason:spec.should==="PARTIAL"?"A non-authoritative purpose hint exists, but no authoritative Purpose Contract is available.":"No authoritative Purpose Contract is available for this observation."};

  const could=spec.could==="PARTIAL"
    ?{status:"PARTIAL" as const,confidence:"OBSERVED_LOWER_BOUND" as const,value:{kind:"BROWSER_REQUEST_EXECUTION" as const,destinationOrigin:spec.destinationOrigin,statement:"Browser-visible execution is a lower bound and not the complete permission surface."},provenance:browserProvenance,reason:"The browser proves this request path could execute, but not the full technical capability."}
    :{status:"UNKNOWN" as const,confidence:"UNKNOWN" as const,value:null,provenance:[],reason:"No capability evidence is available."};

  const eventType=spec.eventType??"product.viewed";
  const why=spec.why==="KNOWN"
    ?{status:"KNOWN" as const,confidence:"OBSERVED" as const,value:{eventId:`stage8-fresh-v3:event:${spec.caseId}`,eventType,correlationStrength:"BUSINESS_OBJECT_HASH" as const},provenance:[{source:"business-event" as const,sourceId:`stage8-fresh-v3:event:${spec.caseId}`,observedAt,confidence:"AUTHORITATIVE" as const}],reason:"A trusted first-party event matches this controlled benchmark observation."}
    :spec.why==="PARTIAL"
      ?{status:"PARTIAL" as const,confidence:"INFERRED" as const,value:{eventId:`stage8-fresh-v3:event:${spec.caseId}`,eventType,correlationStrength:"TRIGGER_WINDOW" as const},provenance:[{source:"business-event" as const,sourceId:`stage8-fresh-v3:event:${spec.caseId}`,observedAt,confidence:"AUTHORITATIVE" as const}],reason:"A first-party event is nearby in time, but object-level correlation is unavailable."}
      :{status:"UNKNOWN" as const,confidence:"UNKNOWN" as const,value:null,provenance:[],reason:"No trusted first-party business event is correlated."};

  return {
    recordId:`browser:stage8-fresh-v3:${spec.caseId}`,
    observedAt,
    integrationId:spec.integrationId,
    integrationResolution:spec.integrationResolution,
    should,could,
    did:{status:"KNOWN",confidence:"OBSERVED",value:{boundary:"browser",phase:"ATTEMPTED",pageOrigin:spec.pageOrigin,destinationOrigin:spec.destinationOrigin,destinationPath:spec.destinationPath,method:spec.method,resourceType:spec.resourceType,initiatorType:"script",hasPostData:spec.method==="POST",originRelationship:spec.originRelationship,...(spec.dataCategories?{dataCategories:spec.dataCategories}:{})},provenance:browserProvenance,reason:"The browser sensor observed this request metadata."},
    why,
    coverage:{label:spec.coverageLabel,boundaries:["browser"],limitations:spec.coverageLabel==="BROWSER_ONLY"?["Backend permissions are not visible.","Server-to-server activity and downstream vendor behavior are not visible."]:["The benchmark includes browser evidence plus supplied first-party context, with no inference beyond those boundaries."]}
  };
}
