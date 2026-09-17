import { BrowserObservationValidationError } from "../src/infrastructure/browser-evidence/browser-evidence-adapter.js";
import { ingestAndPersistBrowserObservation } from "../src/infrastructure/browser-evidence/browser-observation-pipeline.js";
import {
  EvidencePersistenceError,
  SupabaseEvidenceHistoryStore,
} from "../src/infrastructure/evidence-history/supabase-evidence-history-store.js";

interface ApiRequest {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  end(): void;
}

interface RuntimeConfiguration {
  supabaseUrl: string;
  serviceRoleKey: string;
  ingestionToken: string;
  environment: string;
}

const MAX_BODY_BYTES = 8 * 1024;

export default async function handler(
  request: ApiRequest,
  response: ApiResponse,
): Promise<void> {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET" && request.method !== "POST") {
    response.status(405).json({ error: "METHOD_NOT_ALLOWED" });
    return;
  }

  const configuration = readConfiguration();
  if (!configuration) {
    response.status(503).json({ error: "PERSISTENCE_NOT_CONFIGURED" });
    return;
  }

  if (!isAuthorized(request, configuration.ingestionToken)) {
    response.status(401).json({ error: "UNAUTHORIZED_SENSOR" });
    return;
  }

  const store = new SupabaseEvidenceHistoryStore({
    projectUrl: configuration.supabaseUrl,
    serviceRoleKey: configuration.serviceRoleKey,
  });

  if (request.method === "GET") {
    try {
      const history = await store.list(readLimit(request.query?.limit));
      response.status(200).json({ history });
    } catch (error) {
      handleServerError(error, response);
    }
    return;
  }

  const input = parseBody(request.body);
  if (input === null) {
    response.status(400).json({ error: "INVALID_JSON" });
    return;
  }

  if (byteLength(input) > MAX_BODY_BYTES) {
    response.status(413).json({ error: "PAYLOAD_TOO_LARGE" });
    return;
  }

  try {
    const result = await ingestAndPersistBrowserObservation(
      input,
      store,
      configuration.environment,
    );

    response.status(202).json({
      accepted: true,
      persisted: result.persisted,
      acceptedAt: result.acceptedAt,
      evidence: result.evidence,
      integrationResolution: result.integrationResolution,
    });
  } catch (error) {
    if (error instanceof BrowserObservationValidationError) {
      response.status(400).json({
        error: "INVALID_BROWSER_OBSERVATION",
        message: error.message,
      });
      return;
    }

    handleServerError(error, response);
  }
}

function handleServerError(error: unknown, response: ApiResponse): void {
  if (error instanceof EvidencePersistenceError) {
    console.error("[ThirdSight] Evidence persistence failed.", error.message);
    response.status(503).json({ error: "EVIDENCE_PERSISTENCE_FAILED" });
    return;
  }

  console.error("[ThirdSight] Browser observation ingestion failed.", error);
  response.status(500).json({ error: "INGESTION_FAILED" });
}

function readConfiguration(): RuntimeConfiguration | null {
  const supabaseUrl = readEnv("THIRDSIGHT_SUPABASE_URL");
  const serviceRoleKey = readEnv("THIRDSIGHT_SUPABASE_SERVICE_ROLE_KEY");
  const ingestionToken = readEnv("THIRDSIGHT_INGESTION_TOKEN");
  const environment = readEnv("THIRDSIGHT_ENVIRONMENT");

  if (!supabaseUrl || !serviceRoleKey || !ingestionToken || !environment) return null;
  return { supabaseUrl, serviceRoleKey, ingestionToken, environment };
}

function readEnv(name: string): string | null {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  const value = runtime.process?.env?.[name]?.trim();
  return value ? value : null;
}

function isAuthorized(request: ApiRequest, expectedToken: string): boolean {
  const header = request.headers?.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (typeof value !== "string" || !value.startsWith("Bearer ")) return false;
  return value.slice("Bearer ".length) === expectedToken;
}

function readLimit(value: string | string[] | undefined): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = candidate ? Number.parseInt(candidate, 10) : 50;
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(100, parsed));
}

function parseBody(body: unknown): unknown | null {
  if (typeof body !== "string") return body ?? null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
}

function byteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
