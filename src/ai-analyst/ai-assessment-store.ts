import type { AiAnalystInput, AiAnalystAssessment } from "./ai-analyst.js";
import type { AiAnalystRunResult } from "./vercel-ai-gateway.js";

export const AI_ANALYST_VERSION = "stage8-v1";

export interface PersistedAiAssessment {
  assessmentId: string;
  recordId: string;
  analystVersion: string;
  model: string;
  evaluationCaseId: string | null;
  inputSnapshot: AiAnalystInput;
  output: AiAnalystAssessment;
  accepted: boolean;
  authorityViolation: boolean;
  createdAt: string;
}

export class SupabaseAiAssessmentStore {
  constructor(
    private readonly config: {
      projectUrl: string;
      serviceRoleKey: string;
    },
  ) {}

  async append(
    input: AiAnalystInput,
    result: AiAnalystRunResult,
    evaluationCaseId: string | null,
  ): Promise<PersistedAiAssessment> {
    const createdAt = new Date().toISOString();
    const assessmentId = `ai:${AI_ANALYST_VERSION}:${input.recordId}:${createdAt}`;
    const row = {
      assessment_id: assessmentId,
      record_id: input.recordId,
      analyst_version: AI_ANALYST_VERSION,
      model: result.model,
      evaluation_case_id: evaluationCaseId,
      input_snapshot: input,
      output: result.assessment,
      accepted: result.accepted,
      authority_violation: result.authorityViolation,
      created_at: createdAt,
    };

    const url = this.restUrl("ai_assessments");
    await this.request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });

    return {
      assessmentId,
      recordId: input.recordId,
      analystVersion: AI_ANALYST_VERSION,
      model: result.model,
      evaluationCaseId,
      inputSnapshot: input,
      output: result.assessment,
      accepted: result.accepted,
      authorityViolation: result.authorityViolation,
      createdAt,
    };
  }

  async latestForRecords(
    recordIds: readonly string[],
  ): Promise<Map<string, PersistedAiAssessment>> {
    if (recordIds.length === 0) return new Map();
    const url = this.restUrl("ai_assessments");
    url.searchParams.set(
      "select",
      "assessment_id,record_id,analyst_version,model,evaluation_case_id,input_snapshot,output,accepted,authority_violation,created_at",
    );
    url.searchParams.set(
      "record_id",
      `in.(${recordIds.map(escapePostgrestValue).join(",")})`,
    );
    url.searchParams.set("order", "created_at.desc");

    const rows = await this.requestJson<
      Array<{
        assessment_id: string;
        record_id: string;
        analyst_version: string;
        model: string;
        evaluation_case_id: string | null;
        input_snapshot: AiAnalystInput;
        output: AiAnalystAssessment;
        accepted: boolean;
        authority_violation: boolean;
        created_at: string;
      }>
    >(url, { method: "GET" });

    const latest = new Map<string, PersistedAiAssessment>();
    for (const row of rows) {
      if (latest.has(row.record_id)) continue;
      latest.set(row.record_id, {
        assessmentId: row.assessment_id,
        recordId: row.record_id,
        analystVersion: row.analyst_version,
        model: row.model,
        evaluationCaseId: row.evaluation_case_id,
        inputSnapshot: row.input_snapshot,
        output: row.output,
        accepted: row.accepted,
        authorityViolation: row.authority_violation,
        createdAt: row.created_at,
      });
    }
    return latest;
  }

  private restUrl(table: string): URL {
    return new URL(`/rest/v1/${table}`, this.config.projectUrl);
  }

  private async request(url: URL, init: RequestInit): Promise<Response> {
    const response = await fetch(url, {
      ...init,
      headers: {
        apikey: this.config.serviceRoleKey,
        authorization: `Bearer ${this.config.serviceRoleKey}`,
        ...init.headers,
      },
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 1000);
      throw new Error(`Supabase AI assessment request failed (${response.status}): ${detail}`);
    }
    return response;
  }

  private async requestJson<T>(url: URL, init: RequestInit): Promise<T> {
    const response = await this.request(url, init);
    return (await response.json()) as T;
  }
}

function escapePostgrestValue(value: string): string {
  return `"${value.replace(/"/g, '\"')}"`;
}
