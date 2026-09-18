import type { VerificationFinding } from "./deterministic-verifier.js";

export interface ManagedPayload {
  readonly [field: string]: unknown;
}

export interface PreventionResult {
  outcome: "PREVENTED" | "UNCHANGED";
  payload: ManagedPayload;
  removedFields: readonly string[];
  findings: readonly VerificationFinding[];
}

export function constrainManagedPayload(
  payload: ManagedPayload,
  findings: readonly VerificationFinding[],
): PreventionResult {
  const constrained = { ...payload };
  const removed: string[] = [];

  for (const finding of findings) {
    if (finding.type !== "SCOPE_DRIFT" || finding.action !== "CONSTRAIN") continue;
    if (!Object.prototype.hasOwnProperty.call(constrained, finding.field)) continue;
    delete constrained[finding.field];
    removed.push(finding.field);
  }

  return {
    outcome: removed.length > 0 ? "PREVENTED" : "UNCHANGED",
    payload: constrained,
    removedFields: removed,
    findings,
  };
}
