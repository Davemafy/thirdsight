import type { BrowserObservationV1 } from "../infrastructure/browser-evidence/browser-evidence-adapter.js";
import type { EvidenceGraphRecord } from "../domain/evidence.js";
import {
  decideVerification,
  verifyShadowIntegration,
  type VerificationFinding,
} from "../domain/deterministic-verifier.js";
import type { IntegrationResolutionResult } from "../domain/integration-identity.js";
import type { AmbiguousBenchmarkCase } from "./held-out-ambiguous.js";

interface FreshCaseSpec {
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

const BASE_TIME = Date.parse("2026-09-18T16:30:00.000Z");

export const FRESH_AMBIGUOUS_BENCHMARK_ID = "stage8-fresh-v2";

export function buildFreshAmbiguousCasesV2(): AmbiguousBenchmarkCase[] {
  const specs: FreshCaseSpec[] = [
    {
      caseId: "fresh-public-marketing-beacon",
      family: "public-cross-origin-observation",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://market-square.example",
      destinationOrigin: "https://events.measure.example",
      destinationPath: "/v3/beacon",
      originRelationship: "CROSS_ORIGIN",
      method: "POST",
      resourceType: "Fetch",
      should: "UNKNOWN",
      could: "PARTIAL",
      why: "UNKNOWN",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: false,
      inventoryComplete: false,
      expectedRecommendations: ["OBSERVE"],
      usefulReview: true,
      shouldAbstain: false,
    },
    {
      caseId: "fresh-managed-unregistered-pixel",
      family: "managed-unresolved-integration",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://merchant-lab.example",
      destinationOrigin: "https://pixel.unknown-partner.example",
      destinationPath: "/event.gif",
      originRelationship: "CROSS_ORIGIN",
      method: "GET",
      resourceType: "Image",
      should: "UNKNOWN",
      could: "PARTIAL",
      why: "UNKNOWN",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["REVIEW", "OBSERVE"],
      usefulReview: true,
      shouldAbstain: false,
    },
    {
      caseId: "fresh-known-contract-missing-why",
      family: "known-purpose-missing-business-context",
      integrationId: "recommendation-partner",
      integrationResolution: "RESOLVED",
      pageOrigin: "https://merchant-lab.example",
      destinationOrigin: "https://recommend.example",
      destinationPath: "/signals",
      originRelationship: "CROSS_ORIGIN",
      method: "POST",
      resourceType: "Fetch",
      should: "KNOWN",
      could: "PARTIAL",
      why: "UNKNOWN",
      coverageLabel: "MULTI_BOUNDARY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["REVIEW"],
      usefulReview: true,
      shouldAbstain: false,
      dataCategories: ["product.id", "product.category"],
    },
    {
      caseId: "fresh-trigger-window-only",
      family: "weak-temporal-business-correlation",
      integrationId: "recommendation-partner",
      integrationResolution: "RESOLVED",
      pageOrigin: "https://merchant-lab.example",
      destinationOrigin: "https://recommend.example",
      destinationPath: "/signals/batch",
      originRelationship: "CROSS_ORIGIN",
      method: "POST",
      resourceType: "Fetch",
      should: "KNOWN",
      could: "PARTIAL",
      why: "PARTIAL",
      coverageLabel: "MULTI_BOUNDARY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["REVIEW", "OBSERVE"],
      usefulReview: true,
      shouldAbstain: false,
      dataCategories: ["product.id"],
    },
    {
      caseId: "fresh-missing-purpose-known-event",
      family: "missing-purpose-contract",
      integrationId: "recommendation-partner",
      integrationResolution: "RESOLVED",
      pageOrigin: "https://merchant-lab.example",
      destinationOrigin: "https://recommend.example",
      destinationPath: "/context",
      originRelationship: "CROSS_ORIGIN",
      method: "POST",
      resourceType: "Fetch",
      should: "UNKNOWN",
      could: "PARTIAL",
      why: "KNOWN",
      coverageLabel: "MULTI_BOUNDARY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["REVIEW"],
      usefulReview: true,
      shouldAbstain: false,
      dataCategories: ["product.id"],
    },
    {
      caseId: "fresh-partial-purpose-known-event",
      family: "partial-purpose-contract",
      integrationId: "recommendation-partner",
      integrationResolution: "RESOLVED",
      pageOrigin: "https://merchant-lab.example",
      destinationOrigin: "https://recommend.example",
      destinationPath: "/context/partial",
      originRelationship: "CROSS_ORIGIN",
      method: "POST",
      resourceType: "Fetch",
      should: "PARTIAL",
      could: "PARTIAL",
      why: "KNOWN",
      coverageLabel: "MULTI_BOUNDARY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["REVIEW"],
      usefulReview: true,
      shouldAbstain: false,
      dataCategories: ["product.id", "customer.loyalty_tier"],
    },
    {
      caseId: "fresh-opaque-payload-known-purpose",
      family: "known-purpose-opaque-browser-payload",
      integrationId: "recommendation-partner",
      integrationResolution: "RESOLVED",
      pageOrigin: "https://merchant-lab.example",
      destinationOrigin: "https://recommend.example",
      destinationPath: "/opaque",
      originRelationship: "CROSS_ORIGIN",
      method: "POST",
      resourceType: "Fetch",
      should: "KNOWN",
      could: "PARTIAL",
      why: "KNOWN",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["OBSERVE", "REVIEW"],
      usefulReview: true,
      shouldAbstain: false,
    },
    {
      caseId: "fresh-unknown-origin-relationship",
      family: "browser-origin-relationship-unknown",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://merchant-lab.example",
      destinationOrigin: "https://edge-metrics.example",
      destinationPath: "/collect",
      originRelationship: "UNKNOWN",
      method: "POST",
      resourceType: "Fetch",
      should: "UNKNOWN",
      could: "PARTIAL",
      why: "UNKNOWN",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["REVIEW", "OBSERVE"],
      usefulReview: true,
      shouldAbstain: false,
    },
    {
      caseId: "fresh-known-purpose-object-correlation",
      family: "browser-only-known-context",
      integrationId: "recommendation-partner",
      integrationResolution: "RESOLVED",
      pageOrigin: "https://merchant-lab.example",
      destinationOrigin: "https://recommend.example",
      destinationPath: "/view",
      originRelationship: "CROSS_ORIGIN",
      method: "POST",
      resourceType: "Fetch",
      should: "KNOWN",
      could: "PARTIAL",
      why: "KNOWN",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["OBSERVE"],
      usefulReview: true,
      shouldAbstain: false,
      dataCategories: ["product.id", "product.category"],
    },
    {
      caseId: "fresh-public-tag-loader",
      family: "public-script-loader",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://market-square.example",
      destinationOrigin: "https://tags.metrics.example",
      destinationPath: "/loader.js",
      originRelationship: "CROSS_ORIGIN",
      method: "GET",
      resourceType: "Script",
      should: "UNKNOWN",
      could: "PARTIAL",
      why: "UNKNOWN",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: false,
      inventoryComplete: false,
      expectedRecommendations: ["OBSERVE"],
      usefulReview: true,
      shouldAbstain: false,
    },
    {
      caseId: "fresh-same-origin-app-chunk",
      family: "irrelevant-first-party-static",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://merchant-lab.example",
      destinationOrigin: "https://merchant-lab.example",
      destinationPath: "/assets/cart.91d2.js",
      originRelationship: "SAME_ORIGIN",
      method: "GET",
      resourceType: "Script",
      should: "UNKNOWN",
      could: "UNKNOWN",
      why: "UNKNOWN",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["ABSTAIN"],
      usefulReview: false,
      shouldAbstain: true,
    },
    {
      caseId: "fresh-same-origin-status",
      family: "irrelevant-first-party-health",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://merchant-lab.example",
      destinationOrigin: "https://merchant-lab.example",
      destinationPath: "/api/status",
      originRelationship: "SAME_ORIGIN",
      method: "GET",
      resourceType: "Fetch",
      should: "UNKNOWN",
      could: "PARTIAL",
      why: "UNKNOWN",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["ABSTAIN"],
      usefulReview: false,
      shouldAbstain: true,
    },
    {
      caseId: "fresh-public-font-cdn",
      family: "public-static-cdn",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://market-square.example",
      destinationOrigin: "https://static-cdn.example",
      destinationPath: "/fonts/store.woff2",
      originRelationship: "CROSS_ORIGIN",
      method: "GET",
      resourceType: "Fetch",
      should: "UNKNOWN",
      could: "PARTIAL",
      why: "UNKNOWN",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: false,
      inventoryComplete: false,
      expectedRecommendations: ["ABSTAIN"],
      usefulReview: false,
      shouldAbstain: true,
    },
    {
      caseId: "fresh-public-logo-image",
      family: "public-static-image",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://market-square.example",
      destinationOrigin: "https://images-cdn.example",
      destinationPath: "/brand/logo.png",
      originRelationship: "CROSS_ORIGIN",
      method: "GET",
      resourceType: "Image",
      should: "UNKNOWN",
      could: "PARTIAL",
      why: "UNKNOWN",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: false,
      inventoryComplete: false,
      expectedRecommendations: ["ABSTAIN"],
      usefulReview: false,
      shouldAbstain: true,
    },
    {
      caseId: "fresh-same-origin-prefetch",
      family: "irrelevant-first-party-prefetch",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://merchant-lab.example",
      destinationOrigin: "https://merchant-lab.example",
      destinationPath: "/api/catalog/prefetch",
      originRelationship: "SAME_ORIGIN",
      method: "GET",
      resourceType: "Fetch",
      should: "UNKNOWN",
      could: "UNKNOWN",
      why: "UNKNOWN",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["ABSTAIN"],
      usefulReview: false,
      shouldAbstain: true,
    },
    {
      caseId: "fresh-managed-new-endpoint-partial-why",
      family: "managed-new-destination-weak-context",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://merchant-lab.example",
      destinationOrigin: "https://signals-new.example",
      destinationPath: "/v2/commerce",
      originRelationship: "CROSS_ORIGIN",
      method: "POST",
      resourceType: "Fetch",
      should: "UNKNOWN",
      could: "PARTIAL",
      why: "PARTIAL",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["REVIEW", "OBSERVE"],
      usefulReview: true,
      shouldAbstain: false,
      eventType: "checkout.started",
    },
  ];

  return specs.map((spec, index) => buildCase(spec, index));
}

function buildCase(spec: FreshCaseSpec, index: number): AmbiguousBenchmarkCase {
  const observedAt = new Date(BASE_TIME + index * 11_000).toISOString();
  const observation: BrowserObservationV1 = {
    schemaVersion: "browser-observation.v1",
    observationId: `stage8-fresh-v2-${spec.caseId}`,
    sensorId: "stage8-fresh-v2",
    observedAt,
    pageUrl: `${spec.pageOrigin}/evaluation-v2`,
    destinationUrl: `${spec.destinationOrigin}${spec.destinationPath}`,
    method: spec.method,
    resourceType: spec.resourceType,
    initiatorType: "script",
    hasPostData: spec.method === "POST",
  };

  const evidence = makeEvidence(spec, observedAt);
  const findings: readonly VerificationFinding[] = verifyShadowIntegration(evidence, {
    managedEnvironment: spec.managedEnvironment,
    integrationInventoryComplete: spec.inventoryComplete,
  });
  const decision = decideVerification(findings);

  const resolution: IntegrationResolutionResult =
    spec.integrationResolution === "RESOLVED" && spec.integrationId
      ? {
          status: "RESOLVED",
          integrationId: spec.integrationId,
          confidence: "AUTHORITATIVE",
          bindingIds: ["stage8-fresh-v2-binding"],
          sourceIds: ["stage8-fresh-v2-fixture"],
          reason: "Fresh synthetic benchmark identity is declared for evaluation.",
        }
      : {
          status: "UNRESOLVED",
          integrationId: null,
          confidence: "UNKNOWN",
          bindingIds: [],
          sourceIds: [],
          reason: "No integration identity is supplied by this fresh benchmark case.",
        };

  return {
    caseId: spec.caseId,
    family: spec.family,
    evidence,
    observation,
    findings,
    decision,
    resolution,
    expectedRecommendations: spec.expectedRecommendations,
    usefulReview: spec.usefulReview,
    shouldAbstain: spec.shouldAbstain,
  };
}

function makeEvidence(spec: FreshCaseSpec, observedAt: string): EvidenceGraphRecord {
  const browserProvenance = [{
    source: "browser" as const,
    sourceId: `stage8-fresh-v2:${spec.caseId}`,
    observedAt,
    confidence: "OBSERVED" as const,
  }];

  const should =
    spec.should === "KNOWN"
      ? {
          status: "KNOWN" as const,
          confidence: "AUTHORITATIVE" as const,
          value: {
            contractId: "recommendation-product-context",
            contractVersion: "2",
            purpose: "Generate on-site product recommendations from approved commerce context",
            resources: ["recommendation.signals"],
            fields: ["product.id", "product.category", "product.price", "customer.loyalty_tier"],
            operations: ["send"],
            validTriggers: ["product.viewed", "checkout.started"],
          },
          provenance: [{
            source: "purpose-contract" as const,
            sourceId: "stage8-fresh-v2:contract:v2",
            observedAt,
            confidence: "AUTHORITATIVE" as const,
          }],
          reason: "An active Purpose Contract is available.",
        }
      : {
          status: spec.should as "UNKNOWN" | "PARTIAL",
          confidence: spec.should === "PARTIAL" ? "INFERRED" as const : "UNKNOWN" as const,
          value: null,
          provenance: [],
          reason: spec.should === "PARTIAL"
            ? "A non-authoritative purpose hint exists, but no authoritative Purpose Contract is available."
            : "No authoritative Purpose Contract is available for this observation.",
        };

  const could =
    spec.could === "PARTIAL"
      ? {
          status: "PARTIAL" as const,
          confidence: "OBSERVED_LOWER_BOUND" as const,
          value: {
            kind: "BROWSER_REQUEST_EXECUTION" as const,
            destinationOrigin: spec.destinationOrigin,
            statement: "Browser-visible execution is a lower bound and not the complete permission surface.",
          },
          provenance: browserProvenance,
          reason: "The browser proves this request path could execute, but not the full technical capability.",
        }
      : {
          status: "UNKNOWN" as const,
          confidence: "UNKNOWN" as const,
          value: null,
          provenance: [],
          reason: "No capability evidence is available.",
        };

  const eventType = spec.eventType ?? "product.viewed";
  const why =
    spec.why === "KNOWN"
      ? {
          status: "KNOWN" as const,
          confidence: "OBSERVED" as const,
          value: {
            eventId: `stage8-fresh-v2:event:${spec.caseId}`,
            eventType,
            correlationStrength: "BUSINESS_OBJECT_HASH" as const,
          },
          provenance: [{
            source: "business-event" as const,
            sourceId: `stage8-fresh-v2:event:${spec.caseId}`,
            observedAt,
            confidence: "AUTHORITATIVE" as const,
          }],
          reason: "A trusted first-party event matches this controlled benchmark observation.",
        }
      : spec.why === "PARTIAL"
        ? {
            status: "PARTIAL" as const,
            confidence: "INFERRED" as const,
            value: {
              eventId: `stage8-fresh-v2:event:${spec.caseId}`,
              eventType,
              correlationStrength: "TRIGGER_WINDOW" as const,
            },
            provenance: [{
              source: "business-event" as const,
              sourceId: `stage8-fresh-v2:event:${spec.caseId}`,
              observedAt,
              confidence: "AUTHORITATIVE" as const,
            }],
            reason: "A first-party event is nearby in time, but object-level correlation is unavailable.",
          }
        : {
            status: "UNKNOWN" as const,
            confidence: "UNKNOWN" as const,
            value: null,
            provenance: [],
            reason: "No trusted first-party business event is correlated.",
          };

  return {
    recordId: `browser:stage8-fresh-v2:${spec.caseId}`,
    observedAt,
    integrationId: spec.integrationId,
    integrationResolution: spec.integrationResolution,
    should,
    could,
    did: {
      status: "KNOWN",
      confidence: "OBSERVED",
      value: {
        boundary: "browser",
        phase: "ATTEMPTED",
        pageOrigin: spec.pageOrigin,
        destinationOrigin: spec.destinationOrigin,
        destinationPath: spec.destinationPath,
        method: spec.method,
        resourceType: spec.resourceType,
        initiatorType: "script",
        hasPostData: spec.method === "POST",
        originRelationship: spec.originRelationship,
        ...(spec.dataCategories ? { dataCategories: spec.dataCategories } : {}),
      },
      provenance: browserProvenance,
      reason: "The browser sensor observed this request metadata.",
    },
    why,
    coverage: {
      label: spec.coverageLabel,
      boundaries: ["browser"],
      limitations:
        spec.coverageLabel === "BROWSER_ONLY"
          ? [
              "Backend permissions are not visible.",
              "Server-to-server activity and downstream vendor behavior are not visible.",
            ]
          : ["The benchmark includes browser evidence plus supplied first-party context, with no inference beyond those boundaries."],
    },
  };
}
