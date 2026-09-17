import type {
  IntegrationBindingConfidence,
  IntegrationOriginBinding,
} from "../../domain/integration-identity.js";
import type {
  EvidenceHistoryEntry,
  EvidenceHistoryStore,
} from "./evidence-history-store.js";

interface SupabaseEvidenceHistoryStoreConfig { projectUrl: string; serviceRoleKey: string; fetchImpl?: typeof fetch; }
interface OriginBindingRow { binding_id: string; integration_id: string; origin: string; environment: string; confidence: string; source_id: string; valid_from: string; valid_to: string | null; }
interface EvidenceHistoryRow { payload: unknown; }

export class EvidencePersistenceError extends Error { constructor(message: string) { super(message); this.name = "EvidencePersistenceError"; } }

export class SupabaseEvidenceHistoryStore implements EvidenceHistoryStore {
  private readonly projectUrl: string;
  private readonly serviceRoleKey: string;
  private readonly fetchImpl: typeof fetch;
  constructor(config: SupabaseEvidenceHistoryStoreConfig) { this.projectUrl = normalizeProjectUrl(config.projectUrl); this.serviceRoleKey = config.serviceRoleKey.trim(); this.fetchImpl = config.fetchImpl ?? fetch; if (this.serviceRoleKey.length === 0) throw new EvidencePersistenceError("Supabase service-role key is required."); }
  async findActiveOriginBindings(origin: string, environment: string, observedAt: string): Promise<readonly IntegrationOriginBinding[]> {
    const url = this.restUrl("integration_origin_bindings");
    url.searchParams.set("select", "binding_id,integration_id,origin,environment,confidence,source_id,valid_from,valid_to");
    url.searchParams.set("origin", `eq.${new URL(origin).origin}`);
    url.searchParams.set("environment", `eq.${environment}`);
    const rows = await this.requestJson<OriginBindingRow[]>(url, { method: "GET" });
    const at = Date.parse(observedAt);
    return rows.map(parseBindingRow).filter((binding): binding is IntegrationOriginBinding => binding !== null).filter((binding) => { const from = Date.parse(binding.validFrom); const until = binding.validTo === null ? null : Date.parse(binding.validTo); return from <= at && (until === null || until > at); });
  }
  async append(entry: EvidenceHistoryEntry): Promise<void> {
    const url = this.restUrl("browser_evidence_history"); url.searchParams.set("on_conflict", "record_id");
    await this.request(url, { method: "POST", headers: { "content-type": "application/json", prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ record_id: entry.recordId, observation_id: entry.observationId, accepted_at: entry.acceptedAt, observed_at: entry.evidence.observedAt, destination_origin: entry.evidence.did.value?.destinationOrigin ?? null, integration_id: entry.evidence.integrationId, integration_resolution: entry.evidence.integrationResolution, payload: entry }) });
  }
  async list(limit = 50): Promise<readonly EvidenceHistoryEntry[]> { const safeLimit = Math.max(1, Math.min(100, Math.floor(limit))); const url = this.restUrl("browser_evidence_history"); url.searchParams.set("select", "payload"); url.searchParams.set("order", "observed_at.desc"); url.searchParams.set("limit", String(safeLimit)); const rows = await this.requestJson<EvidenceHistoryRow[]>(url, { method: "GET" }); return rows.map((row) => row.payload).filter(isEvidenceHistoryEntry); }
  private restUrl(table: string): URL { return new URL(`/rest/v1/${table}`, `${this.projectUrl}/`); }
  private async requestJson<T>(url: URL, init: RequestInit): Promise<T> { const response = await this.request(url, init); try { return (await response.json()) as T; } catch { throw new EvidencePersistenceError("Supabase returned invalid JSON."); } }
  private async request(url: URL, init: RequestInit): Promise<Response> { const headers = new Headers(init.headers); headers.set("apikey", this.serviceRoleKey); headers.set("authorization", `Bearer ${this.serviceRoleKey}`); headers.set("accept", "application/json"); const response = await this.fetchImpl(url, { ...init, headers, cache: "no-store" }); if (!response.ok) { const detail = await response.text().catch(() => ""); throw new EvidencePersistenceError(`Supabase request failed with ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`); } return response; }
}

function normalizeProjectUrl(value: string): string { let parsed: URL; try { parsed = new URL(value); } catch { throw new EvidencePersistenceError("Supabase project URL must be a valid URL."); } const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1"; if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) throw new EvidencePersistenceError("Supabase project URL must use HTTPS, except for localhost development."); return parsed.origin; }
function parseBindingRow(row: OriginBindingRow): IntegrationOriginBinding | null { if (!isBindingConfidence(row.confidence)) return null; if (!row.binding_id || !row.integration_id || !row.origin || !row.environment) return null; if (!row.source_id || Number.isNaN(Date.parse(row.valid_from))) return null; if (row.valid_to !== null && Number.isNaN(Date.parse(row.valid_to))) return null; return { bindingId: row.binding_id, integrationId: row.integration_id, origin: row.origin, environment: row.environment, confidence: row.confidence, sourceId: row.source_id, validFrom: row.valid_from, validTo: row.valid_to }; }
function isBindingConfidence(value: string): value is IntegrationBindingConfidence { return value === "AUTHORITATIVE" || value === "DECLARED"; }
function isEvidenceHistoryEntry(value: unknown): value is EvidenceHistoryEntry { if (typeof value !== "object" || value === null || Array.isArray(value)) return false; const record = value as Record<string, unknown>; return typeof record.recordId === "string" && typeof record.observationId === "string" && typeof record.acceptedAt === "string" && typeof record.observation === "object" && record.observation !== null && typeof record.evidence === "object" && record.evidence !== null && typeof record.integrationResolution === "object" && record.integrationResolution !== null; }
