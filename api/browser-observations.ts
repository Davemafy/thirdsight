import { BrowserObservationValidationError } from "../src/infrastructure/browser-evidence/browser-evidence-adapter";
import { ingestBrowserObservation } from "../src/infrastructure/browser-evidence/browser-observation-ingestion";

interface ApiRequest {
  method?: string;
  body?: unknown;
}

interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
  end(): void;
}

const MAX_BODY_BYTES = 8 * 1024;

export default function handler(request: ApiRequest, response: ApiResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ error: "METHOD_NOT_ALLOWED" });
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
    const result = ingestBrowserObservation(input);
    response.status(202).json({
      accepted: true,
      acceptedAt: result.acceptedAt,
      evidence: result.evidence,
    });
  } catch (error) {
    if (error instanceof BrowserObservationValidationError) {
      response.status(400).json({
        error: "INVALID_BROWSER_OBSERVATION",
        message: error.message,
      });
      return;
    }

    console.error("[ThirdSight] Browser observation ingestion failed.", error);
    response.status(500).json({ error: "INGESTION_FAILED" });
  }
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
