import type { EvidenceConfidence, EvidenceGraphRecord } from "./evidence.js";

export type IntegrationBindingConfidence = Extract<EvidenceConfidence, "AUTHORITATIVE" | "DECLARED">;
export interface IntegrationOriginBinding { bindingId: string; integrationId: string; origin: string; environment: string; confidence: IntegrationBindingConfidence; sourceId: string; validFrom: string; validTo: string | null; }
export interface IntegrationResolutionResult { status: "RESOLVED" | "UNRESOLVED" | "AMBIGUOUS"; integrationId: string | null; confidence: IntegrationBindingConfidence | "UNKNOWN"; bindingIds: readonly string[]; sourceIds: readonly string[]; reason: string; }
export interface ResolvedEvidenceGraph { evidence: EvidenceGraphRecord; resolution: IntegrationResolutionResult; }

export function resolveIntegrationIdentity(evidence: EvidenceGraphRecord, bindings: readonly IntegrationOriginBinding[], environment: string): ResolvedEvidenceGraph {
  const destinationOrigin = evidence.did.value?.destinationOrigin;
  if (!destinationOrigin) return unresolved(evidence, "No observed destination origin is available for identity resolution.");
  const observedAt = Date.parse(evidence.observedAt);
  const normalizedDestination = normalizeOrigin(destinationOrigin);
  const matching = bindings.filter((binding) => {
    if (binding.environment !== environment) return false;
    if (normalizeOrigin(binding.origin) !== normalizedDestination) return false;
    const validFrom = Date.parse(binding.validFrom);
    if (Number.isNaN(validFrom) || validFrom > observedAt) return false;
    if (binding.validTo !== null) { const validTo = Date.parse(binding.validTo); if (Number.isNaN(validTo) || validTo <= observedAt) return false; }
    return true;
  });
  if (matching.length === 0) return unresolved(evidence, `No active exact-origin binding exists for ${normalizedDestination} in ${environment}.`);
  const integrationIds = [...new Set(matching.map((binding) => binding.integrationId))];
  if (integrationIds.length > 1) return { evidence: { ...evidence, integrationId: null, integrationResolution: "AMBIGUOUS" }, resolution: { status: "AMBIGUOUS", integrationId: null, confidence: "UNKNOWN", bindingIds: matching.map((binding) => binding.bindingId), sourceIds: matching.map((binding) => binding.sourceId), reason: "Multiple active exact-origin bindings point to different integrations; ThirdSight refuses to guess ownership." } };
  const integrationId = integrationIds[0];
  const strongest = matching.some((binding) => binding.confidence === "AUTHORITATIVE") ? "AUTHORITATIVE" : "DECLARED";
  return { evidence: { ...evidence, integrationId, integrationResolution: "RESOLVED" }, resolution: { status: "RESOLVED", integrationId, confidence: strongest, bindingIds: matching.map((binding) => binding.bindingId), sourceIds: matching.map((binding) => binding.sourceId), reason: strongest === "AUTHORITATIVE" ? "Resolved by an active exact-origin merchant registry binding." : "Resolved by an active exact-origin declared binding; ownership remains declared rather than independently proven." } };
}
function unresolved(evidence: EvidenceGraphRecord, reason: string): ResolvedEvidenceGraph { return { evidence: { ...evidence, integrationId: null, integrationResolution: "UNRESOLVED" }, resolution: { status: "UNRESOLVED", integrationId: null, confidence: "UNKNOWN", bindingIds: [], sourceIds: [], reason } }; }
function normalizeOrigin(value: string): string { try { return new URL(value).origin.toLowerCase(); } catch { return value.trim().toLowerCase(); } }
