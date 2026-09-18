import type {
  LearningCandidate,
  LearningExample,
  LearningFeatures,
  LearningLabel,
  LearningMetrics,
  LinearAdvisoryModel,
} from "./learning-loop.js";

export interface PersistedLearningFeedback {
  feedbackId: string;
  recordId: string;
  label: LearningLabel;
  features: LearningFeatures;
  source: "HUMAN_VERIFIED";
  createdAt: string;
}

export interface PersistedLearningModelRun {
  runId: string;
  modelVersion: string;
  algorithm: string;
  trainingExamples: number;
  humanVerifiedExamples: number;
  benchmarkId: string;
  baselineMetrics: LearningMetrics;
  candidateMetrics: LearningMetrics;
  model: LinearAdvisoryModel;
  promoted: boolean;
  promotionReason: string;
  createdAt: string;
}

export class SupabaseLearningStore {
  constructor(
    private readonly config: {
      projectUrl: string;
      serviceRoleKey: string;
    },
  ) {}

  async appendFeedback(input: {
    recordId: string;
    label: LearningLabel;
    features: LearningFeatures;
  }): Promise<{ feedback: PersistedLearningFeedback; inserted: boolean }> {
    const existing = await this.feedbackForRecord(input.recordId);
    if (existing) return { feedback: existing, inserted: false };

    const createdAt = new Date().toISOString();
    const feedbackId = `feedback:${input.recordId}`;
    const url = this.restUrl("learning_feedback");
    url.searchParams.set("on_conflict", "record_id");
    const rows = await this.requestJson<Array<{
      feedback_id:string;
      record_id:string;
      label:LearningLabel;
      features:LearningFeatures;
      source:"HUMAN_VERIFIED";
      created_at:string;
    }>>(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        prefer: "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify({
        feedback_id: feedbackId,
        record_id: input.recordId,
        label: input.label,
        features: input.features,
        source: "HUMAN_VERIFIED",
        created_at: createdAt,
      }),
    });

    const row = rows[0];
    if (!row) {
      const duplicate = await this.feedbackForRecord(input.recordId);
      if (!duplicate) throw new Error("Learning feedback insert returned no row.");
      return { feedback: duplicate, inserted: false };
    }
    return { feedback: parseFeedback(row), inserted: true };
  }

  async feedbackForRecord(recordId: string): Promise<PersistedLearningFeedback | null> {
    const url = this.restUrl("learning_feedback");
    url.searchParams.set("select", "feedback_id,record_id,label,features,source,created_at");
    url.searchParams.set("record_id", `eq.${recordId}`);
    url.searchParams.set("limit", "1");
    const rows = await this.requestJson<Array<any>>(url, { method: "GET" });
    return rows[0] ? parseFeedback(rows[0]) : null;
  }

  async listFeedback(limit = 500): Promise<readonly PersistedLearningFeedback[]> {
    const safe = Math.max(1, Math.min(1000, Math.floor(limit)));
    const url = this.restUrl("learning_feedback");
    url.searchParams.set("select", "feedback_id,record_id,label,features,source,created_at");
    url.searchParams.set("order", "created_at.asc");
    url.searchParams.set("limit", String(safe));
    const rows = await this.requestJson<Array<any>>(url, { method: "GET" });
    return rows.map(parseFeedback);
  }

  async latestRun(): Promise<PersistedLearningModelRun | null> {
    return this.latestRunMatching(false);
  }

  async latestPromotedRun(): Promise<PersistedLearningModelRun | null> {
    return this.latestRunMatching(true);
  }

  async latestRunForHumanCount(humanVerifiedExamples: number): Promise<PersistedLearningModelRun | null> {
    const url = this.restUrl("learning_model_runs");
    url.searchParams.set("select", RUN_SELECT);
    url.searchParams.set("human_verified_examples", `eq.${humanVerifiedExamples}`);
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", "1");
    const rows = await this.requestJson<Array<any>>(url, { method: "GET" });
    return rows[0] ? parseRun(rows[0]) : null;
  }

  async appendRun(
    runId: string,
    candidate: LearningCandidate,
    algorithm: string,
  ): Promise<PersistedLearningModelRun> {
    const createdAt = new Date().toISOString();
    const row = {
      run_id: runId,
      model_version: candidate.modelVersion,
      algorithm,
      training_examples: candidate.trainingExamples,
      human_verified_examples: candidate.humanVerifiedExamples,
      benchmark_id: candidate.benchmarkId,
      baseline_metrics: candidate.baselineMetrics,
      candidate_metrics: candidate.candidateMetrics,
      model: candidate.model,
      promoted: candidate.promoted,
      promotion_reason: candidate.promotionReason,
      created_at: createdAt,
    };
    const url = this.restUrl("learning_model_runs");
    url.searchParams.set("on_conflict", "run_id");
    await this.request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    });
    return parseRun(row);
  }

  toLearningExamples(feedback: readonly PersistedLearningFeedback[]): LearningExample[] {
    return feedback.map((row) => ({
      exampleId: row.feedbackId,
      label: row.label,
      features: row.features,
      source: "HUMAN_VERIFIED" as const,
    }));
  }

  private async latestRunMatching(promotedOnly: boolean): Promise<PersistedLearningModelRun | null> {
    const url = this.restUrl("learning_model_runs");
    url.searchParams.set("select", RUN_SELECT);
    if (promotedOnly) url.searchParams.set("promoted", "eq.true");
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", "1");
    const rows = await this.requestJson<Array<any>>(url, { method: "GET" });
    return rows[0] ? parseRun(rows[0]) : null;
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
        accept: "application/json",
        ...init.headers,
      },
      cache: "no-store",
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 800);
      throw new Error(`Supabase learning request failed (${response.status}): ${detail}`);
    }
    return response;
  }

  private async requestJson<T>(url: URL, init: RequestInit): Promise<T> {
    const response = await this.request(url, init);
    return (await response.json()) as T;
  }
}

const RUN_SELECT = "run_id,model_version,algorithm,training_examples,human_verified_examples,benchmark_id,baseline_metrics,candidate_metrics,model,promoted,promotion_reason,created_at";

function parseFeedback(row: any): PersistedLearningFeedback {
  return {
    feedbackId: String(row.feedback_id),
    recordId: String(row.record_id),
    label: row.label as LearningLabel,
    features: row.features as LearningFeatures,
    source: "HUMAN_VERIFIED",
    createdAt: String(row.created_at),
  };
}

function parseRun(row: any): PersistedLearningModelRun {
  return {
    runId: String(row.run_id),
    modelVersion: String(row.model_version),
    algorithm: String(row.algorithm),
    trainingExamples: Number(row.training_examples),
    humanVerifiedExamples: Number(row.human_verified_examples),
    benchmarkId: String(row.benchmark_id),
    baselineMetrics: row.baseline_metrics as LearningMetrics,
    candidateMetrics: row.candidate_metrics as LearningMetrics,
    model: row.model as LinearAdvisoryModel,
    promoted: Boolean(row.promoted),
    promotionReason: String(row.promotion_reason),
    createdAt: String(row.created_at),
  };
}
