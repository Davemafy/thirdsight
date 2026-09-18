import { describe, expect, it } from "vitest";
import type { IntegrationOriginBinding } from "../../domain/integration-identity";
import type {
  EvidenceHistoryEntry,
  EvidenceHistoryStore,
} from "../evidence-history/evidence-history-store";
import { ingestAndPersistBrowserObservation } from "./browser-observation-pipeline";

class FakeEvidenceHistoryStore implements EvidenceHistoryStore {
  bindings: IntegrationOriginBinding[] = [];
  entries: EvidenceHistoryEntry[] = [];

  async findActiveOriginBindings(): Promise<readonly IntegrationOriginBinding[]> {
    return this.bindings;
  }

  async findPurposeContracts() { return []; }
  async findCapabilities() { return []; }
  async findBusinessEvents() { return []; }
  async findIntegrationLifecycle() { return null; }
  async findCredential() { return null; }
  async isolateCredential() { return false; }

  async appendBusinessEvent() { return; }
  async appendBusinessEvents() { return; }

  async append(entry: EvidenceHistoryEntry): Promise<void> {
    this.entries.push(entry);
  }
  async appendMany(entries: readonly EvidenceHistoryEntry[]): Promise<void> {
    this.entries.push(...entries);
  }

  async list(limit = 50): Promise<readonly EvidenceHistoryEntry[]> {
    return this.entries.slice(0, limit);
  }
}

const OBSERVATION = {
  schemaVersion: "browser-observation.v1",
  observationId: "obs-1",
  sensorId: "browser-extension:tab-1",
  observedAt: "2026-09-17T12:00:00.000Z",
  pageUrl: "https://shop.example.com/products",
  destinationUrl: "https://analytics.example.com/collect",
  method: "POST",
  resourceType: "Fetch",
  initiatorType: "script",
  hasPostData: true,
} as const;

describe("ingestAndPersistBrowserObservation", () => {
  it("persists unresolved evidence without inventing integration identity", async () => {
    const store = new FakeEvidenceHistoryStore();

    const result = await ingestAndPersistBrowserObservation(
      OBSERVATION,
      store,
      "demo",
      "2026-09-17T12:00:01.000Z",
    );

    expect(result.persisted).toBe(true);
    expect(result.evidence.integrationId).toBeNull();
    expect(result.evidence.integrationResolution).toBe("UNRESOLVED");
    expect(store.entries).toHaveLength(1);
    expect(store.entries[0].observation).toEqual(OBSERVATION);
  });

  it("resolves and persists an exact merchant registry binding", async () => {
    const store = new FakeEvidenceHistoryStore();
    store.bindings = [
      {
        bindingId: "binding-analytics",
        integrationId: "analytics-partner",
        origin: "https://analytics.example.com",
        environment: "demo",
        confidence: "AUTHORITATIVE",
        sourceId: "merchant-registry:binding-analytics",
        validFrom: "2026-09-01T00:00:00.000Z",
        validTo: null,
      },
    ];

    const result = await ingestAndPersistBrowserObservation(
      OBSERVATION,
      store,
      "demo",
      "2026-09-17T12:00:01.000Z",
    );

    expect(result.integrationResolution.status).toBe("RESOLVED");
    expect(result.evidence.integrationId).toBe("analytics-partner");
    expect(store.entries[0].evidence.integrationId).toBe("analytics-partner");
  });
});
