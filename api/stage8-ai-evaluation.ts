import { verifyGitHubActionsOidc } from "../src/infrastructure/auth/github-actions-oidc.js";
import {
  buildAiAnalystInput,
  isAiEligibleAmbiguity,
} from "../src/ai-analyst/ai-analyst.js";
import {
  analyzeAmbiguitiesWithGateway,
} from "../src/ai-analyst/vercel-ai-gateway.js";
import {
  compareAiModes,
  evaluateAiOff,
  evaluateAiOn,
} from "../src/ai-analyst/ai-evaluation.js";
import {
  buildHeldOutAmbiguousCases,
} from "../src/ai-analyst/held-out-ambiguous.js";
import {
  AI_ANALYST_VERSION,
  SupabaseAiAssessmentStore,
} from "../src/ai-analyst/ai-assessment-store.js";
import { SupabaseEvidenceHistoryStore } from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";
import type { EvidenceHistoryEntry } from "../src/infrastructure/evidence-history/evidence-history-store.js";

interface ApiRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}
interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

const MODEL = "openai/gpt-5.4";
const WORKFLOW = ".github/workflows/stage8-ai-evaluation.yml";

export default async function handler(
  request: ApiRequest,
  response: ApiResponse,
): Promise<void> {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    return;
  }

  const token = readBearer(request);
  if (
    !token ||
    !(await verifyGitHubActionsOidc(
      token,
      "thirdsight-stage8-ai",
      WORKFLOW,
    ))
  ) {
    response.status(401).json({ error: "UNAUTHORIZED" });
    return;
  }

  const config = readConfig();
  if (!config) {
    response.status(503).json({ error: "PERSISTENCE_NOT_CONFIGURED" });
    return;
  }

  try {
    const evidenceStore = new SupabaseEvidenceHistoryStore(config);
    const aiStore = new SupabaseAiAssessmentStore(config);
    const cases = buildHeldOutAmbiguousCases();

    const ineligible = cases.filter(
      (item) => !isAiEligibleAmbiguity(item.evidence, item.decision),
    );
    if (ineligible.length > 0) {
      throw new Error(
        `Held-out benchmark contains non-ambiguous cases: ${ineligible
          .map((item) => item.caseId)
          .join(", ")}`,
      );
    }

    const entries: EvidenceHistoryEntry[] = cases.map((item) => ({
      recordId: item.evidence.recordId,
      observationId: item.observation.observationId,
      acceptedAt: item.evidence.observedAt,
      observation: item.observation,
      evidence: item.evidence,
      integrationResolution: item.resolution,
      findings: item.findings,
      enforcement: null,
      outcome: null,
      decision: item.decision,
      containment: null,
      blindSpotAssessment: null,
    }));
    await evidenceStore.appendMany(entries);

    const inputs = cases.map((item) =>
      buildAiAnalystInput(item.evidence, item.decision, item.findings),
    );

    const aiOff = evaluateAiOff(cases);
    const results = await analyzeAmbiguitiesWithGateway(inputs, {
      model: MODEL,
    });

    await Promise.all(
      results.map((result, index) =>
        aiStore.append(inputs[index], result, cases[index].caseId),
      ),
    );

    const aiOn = evaluateAiOn(cases, results);
    const comparison = compareAiModes(aiOff, aiOn);
    const runId = `stage8-eval-${Date.now()}`;
    await aiStore.appendEvaluationRun({
      runId,
      model: MODEL,
      caseCount: cases.length,
      aiOff,
      aiOn,
      improvement: comparison.improvement,
      surfaceProminently: comparison.surfaceProminently,
      surfaceReason: comparison.surfaceReason,
    });

    response.status(200).json({
      ok: true,
      stage: "Stage 8 — AI analyst",
      analystVersion: AI_ANALYST_VERSION,
      model: MODEL,
      frozenDetector: "stage7-v1-frozen",
      detectorModified: false,
      factualEvidenceMutatedByAi: false,
      rawPayloadsSentToAi: false,
      piiValuesSentToAi: false,
      heldOutCases: cases.length,
      aiOff: aiOff.metrics,
      aiOn: aiOn.metrics,
      improvement: comparison.improvement,
      surfaceProminently: comparison.surfaceProminently,
      surfaceReason: comparison.surfaceReason,
      authorityViolations: aiOn.metrics.authorityViolations,
      rejectedAssessments: results.filter((result) => !result.accepted).length,
      runId,
      cases: cases.map((item, index) => ({
        caseId: item.caseId,
        family: item.family,
        recordId: item.evidence.recordId,
        deterministicDecision: item.decision,
        ai: {
          accepted: results[index].accepted,
          assessment: results[index].assessment.assessment,
          confidence: results[index].assessment.confidence,
          recommendedResponse:
            results[index].assessment.recommended_response,
          unsupportedAssumptions:
            results[index].assessment.unsupported_assumptions,
        },
      })),
    });
  } catch (error) {
    console.error("[ThirdSight] Stage 8 AI evaluation failed.", error);
    response.status(500).json({
      error: "STAGE8_AI_EVALUATION_FAILED",
      message: error instanceof Error ? error.message : "Unknown failure",
    });
  }
}

function readBearer(request: ApiRequest): string | null {
  const raw = request.headers?.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && value.startsWith("Bearer ")
    ? value.slice(7)
    : null;
}

function readConfig():
  | { projectUrl: string; serviceRoleKey: string }
  | null {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const projectUrl =
    runtime.process?.env?.THIRDSIGHT_SUPABASE_URL?.trim();
  const serviceRoleKey =
    runtime.process?.env?.THIRDSIGHT_SUPABASE_SERVICE_ROLE_KEY?.trim();
  return projectUrl && serviceRoleKey
    ? { projectUrl, serviceRoleKey }
    : null;
}
