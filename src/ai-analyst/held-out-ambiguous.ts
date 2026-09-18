import type { BrowserObservationV1 } from "../infrastructure/browser-evidence/browser-evidence-adapter.js";
import type { EvidenceGraphRecord } from "../domain/evidence.js";
import {
  decideVerification,
  verifyShadowIntegration,
  type VerificationAction,
  type VerificationFinding,
} from "../domain/deterministic-verifier.js";
import type { IntegrationResolutionResult } from "../domain/integration-identity.js";

interface AmbiguousCaseSpec {
  caseId: string;
  family: string;
  integrationId: string | null;
  integrationResolution: "RESOLVED" | "UNRESOLVED";
  pageOrigin: string;
  destinationOrigin: string;
  destinationPath: string;
  originRelationship: "SAME_ORIGIN" | "CROSS_ORIGIN" | "UNKNOWN";
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
}

export interface AmbiguousBenchmarkCase {
  caseId: string;
  family: string;
  evidence: EvidenceGraphRecord;
  observation: BrowserObservationV1;
  findings: readonly VerificationFinding[];
  decision: VerificationAction;
  resolution: IntegrationResolutionResult;
  expectedRecommendations: readonly ("OBSERVE" | "REVIEW" | "ABSTAIN")[];
  usefulReview: boolean;
  shouldAbstain: boolean;
}

const BASE_TIME = Date.parse("2026-09-18T15:00:00.000Z");

export function buildHeldOutAmbiguousCases(): AmbiguousBenchmarkCase[] {
  const specs: Array<{
    caseId: string;
    family: string;
    integrationId: string | null;
    integrationResolution: "RESOLVED" | "UNRESOLVED";
    pageOrigin: string;
    destinationOrigin: string;
    destinationPath: string;
    originRelationship: "SAME_ORIGIN" | "CROSS_ORIGIN" | "UNKNOWN";
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
  }> = [
    {
      caseId: "amb-public-cross-origin",
      family: "public-browser-discovery",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://shop-public.example",
      destinationOrigin: "https://telemetry.vendor.example",
      destinationPath: "/collect",
      originRelationship: "CROSS_ORIGIN",
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
      caseId: "amb-managed-shadow",
      family: "managed-shadow-review",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://commerce-lab.example",
      destinationOrigin: "https://unregistered-telemetry.example",
      destinationPath: "/pixel",
      originRelationship: "CROSS_ORIGIN",
      should: "UNKNOWN",
      could: "PARTIAL",
      why: "UNKNOWN",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["OBSERVE", "REVIEW"],
      usefulReview: true,
      shouldAbstain: false,
    },
    {
      caseId: "amb-temporal-only-why",
      family: "weak-business-correlation",
      integrationId: "analytics-partner",
      integrationResolution: "RESOLVED",
      pageOrigin: "https://commerce-lab.example",
      destinationOrigin: "https://analytics.example",
      destinationPath: "/collect",
      originRelationship: "CROSS_ORIGIN",
      should: "KNOWN",
      could: "PARTIAL",
      why: "PARTIAL",
      coverageLabel: "MULTI_BOUNDARY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["REVIEW", "OBSERVE"],
      usefulReview: true,
      shouldAbstain: false,
      dataCategories: ["product.id", "product.category"],
    },
    {
      caseId: "amb-missing-business-context",
      family: "missing-why",
      integrationId: "analytics-partner",
      integrationResolution: "RESOLVED",
      pageOrigin: "https://commerce-lab.example",
      destinationOrigin: "https://analytics.example",
      destinationPath: "/collect",
      originRelationship: "CROSS_ORIGIN",
      should: "KNOWN",
      could: "PARTIAL",
      why: "UNKNOWN",
      coverageLabel: "MULTI_BOUNDARY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["REVIEW"],
      usefulReview: true,
      shouldAbstain: false,
      dataCategories: ["product.id"],
    },
    {
      caseId: "amb-no-purpose-contract",
      family: "missing-should",
      integrationId: "analytics-partner",
      integrationResolution: "RESOLVED",
      pageOrigin: "https://commerce-lab.example",
      destinationOrigin: "https://analytics.example",
      destinationPath: "/collect",
      originRelationship: "CROSS_ORIGIN",
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
      caseId: "amb-same-origin-static",
      family: "irrelevant-same-origin",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://commerce-lab.example",
      destinationOrigin: "https://commerce-lab.example",
      destinationPath: "/assets/app.js",
      originRelationship: "SAME_ORIGIN",
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
      caseId: "amb-browser-health-ping",
      family: "non-business-browser-ping",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://commerce-lab.example",
      destinationOrigin: "https://commerce-lab.example",
      destinationPath: "/health",
      originRelationship: "SAME_ORIGIN",
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
      caseId: "amb-public-cdn",
      family: "public-cdn-visibility",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://shop-public.example",
      destinationOrigin: "https://cdn.example",
      destinationPath: "/bundle.js",
      originRelationship: "CROSS_ORIGIN",
      should: "UNKNOWN",
      could: "PARTIAL",
      why: "UNKNOWN",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: false,
      inventoryComplete: false,
      expectedRecommendations: ["ABSTAIN", "OBSERVE"],
      usefulReview: false,
      shouldAbstain: true,
    },
    {
      caseId: "amb-partial-capability",
      family: "declared-capability-weak-why",
      integrationId: "analytics-partner",
      integrationResolution: "RESOLVED",
      pageOrigin: "https://commerce-lab.example",
      destinationOrigin: "https://analytics.example",
      destinationPath: "/batch",
      originRelationship: "CROSS_ORIGIN",
      should: "KNOWN",
      could: "PARTIAL",
      why: "PARTIAL",
      coverageLabel: "MULTI_BOUNDARY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["REVIEW", "OBSERVE"],
      usefulReview: true,
      shouldAbstain: false,
      dataCategories: ["product.id", "customer.loyalty_tier"],
    },
    {
      caseId: "amb-unresolved-managed-destination",
      family: "managed-unknown-destination",
      integrationId: null,
      integrationResolution: "UNRESOLVED",
      pageOrigin: "https://commerce-lab.example",
      destinationOrigin: "https://metrics-new.example",
      destinationPath: "/v1/event",
      originRelationship: "CROSS_ORIGIN",
      should: "UNKNOWN",
      could: "PARTIAL",
      why: "PARTIAL",
      coverageLabel: "BROWSER_ONLY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["OBSERVE", "REVIEW"],
      usefulReview: true,
      shouldAbstain: false,
    },
    {
      caseId: "amb-purpose-known-no-data-categories",
      family: "known-purpose-opaque-payload",
      integrationId: "analytics-partner",
      integrationResolution: "RESOLVED",
      pageOrigin: "https://commerce-lab.example",
      destinationOrigin: "https://analytics.example",
      destinationPath: "/opaque",
      originRelationship: "CROSS_ORIGIN",
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
      caseId: "amb-no-contract-no-why",
      family: "double-unknown",
      integrationId: "analytics-partner",
      integrationResolution: "RESOLVED",
      pageOrigin: "https://commerce-lab.example",
      destinationOrigin: "https://analytics.example",
      destinationPath: "/unknown-context",
      originRelationship: "CROSS_ORIGIN",
      should: "UNKNOWN",
      could: "PARTIAL",
      why: "UNKNOWN",
      coverageLabel: "MULTI_BOUNDARY",
      managedEnvironment: true,
      inventoryComplete: true,
      expectedRecommendations: ["REVIEW", "ABSTAIN"],
      usefulReview: true,
      shouldAbstain: false,
      dataCategories: ["product.id"],
    },
  ];

  return specs.map((spec, index) => buildCase(spec, index));
}

function buildCase(
  spec: Parameters<typeof buildHeldOutAmbiguousCases>[0] extends never ? never : any,
  index: number,
): AmbiguousBenchmarkCase {
  const observedAt = new Date(BASE_TIME + index * 10_000).toISOString();
  const observation: BrowserObservationV1 = {
    schemaVersion: "browser-observation.v1",
    observationId: `stage8-${spec.caseId}`,
    sensorId: "stage8-held-out",
    observedAt,
    pageUrl: `${spec.pageOrigin}/stage8`,
    destinationUrl: `${spec.destinationOrigin}${spec.destinationPath}`,
    method: spec.destinationPath.endsWith(".js") ? "GET" : "POST",
    resourceType: spec.destinationPath.endsWith(".js") ? "Script" : "Fetch",
    initiatorType: "script",
    hasPostData: !spec.destinationPath.endsWith(".js"),
  };

  const evidence = makeEvidence(spec, observedAt);
  const shadowFindings = verifyShadowIntegration(evidence, {
    managedEnvironment: spec.managedEnvironment,
    integrationInventoryComplete: spec.inventoryComplete,
  });
  const findings: readonly VerificationFinding[] = shadowFindings;
  const decision = decideVerification(findings);

  const resolution: IntegrationResolutionResult =
    spec.integrationResolution === "RESOLVED" && spec.integrationId
      ? {
          status: "RESOLVED",
          integrationId: spec.integrationId,
          confidence: "AUTHORITATIVE",
          bindingIds: ["stage8-held-out-binding"],
          sourceIds: ["stage8-held-out-fixture"],
          reason: "Held-out synthetic benchmark identity is declared for evaluation.",
        }
      : {
          status: "UNRESOLVED",
          integrationId: null,
          confidence: "UNKNOWN",
          bindingIds: [],
          sourceIds: [],
          reason: "No integration identity is supplied by this held-out case.",
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

function makeEvidence(spec: AmbiguousCaseSpec, observedAt: string): EvidenceGraphRecord {
  const browserProvenance = [{
    source: "browser" as const,
    sourceId: `stage8:${spec.caseId}`,
    observedAt,
    confidence: "OBSERVED" as const,
  }];

  const should =
    spec.should === "KNOWN"
      ? {
          status: "KNOWN" as const,
          confidence: "AUTHORITATIVE" as const,
          value: {
            contractId: "analytics-product-view",
            contractVersion: "5",
            purpose: "Measure product interest with approved segmentation",
            resources: ["analytics.events"],
            fields: ["product.id", "product.category", "product.price", "customer.loyalty_tier"],
            operations: ["send"],
            validTriggers: ["product.viewed"],
          },
          provenance: [{
            source: "purpose-contract" as const,
            sourceId: "stage8:contract:v5",
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
          reason: "No authoritative Purpose Contract is available for this observation.",
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

  const why =
    spec.why === "KNOWN"
      ? {
          status: "KNOWN" as const,
          confidence: "OBSERVED" as const,
          value: {
            eventId: `stage8:event:${spec.caseId}`,
            eventType: "product.viewed",
            correlationStrength: "BUSINESS_OBJECT_HASH" as const,
          },
          provenance: [{
            source: "business-event" as const,
            sourceId: `stage8:event:${spec.caseId}`,
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
              eventId: `stage8:event:${spec.caseId}`,
              eventType: "product.viewed",
              correlationStrength: "TRIGGER_WINDOW" as const,
            },
            provenance: [{
              source: "business-event" as const,
              sourceId: `stage8:event:${spec.caseId}`,
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
    recordId: `browser:stage8-held-out:${spec.caseId}`,
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
        method: spec.destinationPath.endsWith(".js") ? "GET" : "POST",
        resourceType: spec.destinationPath.endsWith(".js") ? "Script" : "Fetch",
        initiatorType: "script",
        hasPostData: !spec.destinationPath.endsWith(".js"),
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
          : ["The benchmark includes browser evidence but no inference beyond supplied boundaries."],
    },
  };
}
