import { afterEach, describe, expect, it, vi } from "vitest";
import { SupabaseAiAssessmentStore } from "./ai-assessment-store.js";

const config = {
  projectUrl: "https://example.supabase.co",
  serviceRoleKey: "test-service-role",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Stage 8 — promoted analyst selection", () => {
  it("selects the latest evaluation that actually cleared the promotion gate", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo) => {
        urls.push(String(input));
        return new Response(
          JSON.stringify([
            {
              run_id: "promoted-run",
              analyst_version: "stage8-v2",
              model: "openai/gpt-oss-120b@groq",
              case_count: 16,
              ai_off: {},
              ai_on: {},
              improvement: {},
              surface_prominently: true,
              surface_reason: "passed",
              created_at: "2026-09-18T17:44:03.925Z",
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );

    const store = new SupabaseAiAssessmentStore(config);
    const run = await store.latestPromotedEvaluationRun();

    expect(run?.runId).toBe("promoted-run");
    const query = new URL(urls[0]).searchParams;
    expect(query.get("surface_prominently")).toBe("eq.true");
    expect(query.get("order")).toBe("created_at.desc");
    expect(query.get("limit")).toBe("1");
  });

  it("loads console assessments only from the active promoted model", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo) => {
        urls.push(String(input));
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    const store = new SupabaseAiAssessmentStore(config);
    await store.latestForRecords(
      ["browser:stage8-fresh-v2:one"],
      {
        analystVersion: "stage8-v2",
        model: "openai/gpt-oss-120b@groq",
        acceptedOnly: true,
      },
    );

    const query = new URL(urls[0]).searchParams;
    expect(query.get("analyst_version")).toBe("eq.stage8-v2");
    expect(query.get("model")).toBe("eq.openai/gpt-oss-120b@groq");
    expect(query.get("accepted")).toBe("eq.true");
  });
});
