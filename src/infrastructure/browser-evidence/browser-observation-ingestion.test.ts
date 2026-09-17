import { describe, expect, it } from "vitest";
import { ingestBrowserObservation } from "./browser-observation-ingestion";

const observation = {
  schemaVersion: "browser-observation.v1",
  observationId: "obs-1",
  sensorId: "browser-extension:tab-7",
  observedAt: "2026-09-17T13:00:00.000Z",
  pageUrl: "https://shop.example/products/1",
  destinationUrl: "https://analytics.example/collect?email=should-not-survive",
  method: "post",
  resourceType: "Fetch",
  initiatorType: "script",
  hasPostData: true,
} as const;

describe("ingestBrowserObservation", () => {
  it("returns validated observation plus conservative evidence projection", () => {
    const result = ingestBrowserObservation(
      observation,
      "2026-09-17T13:00:01.000Z",
    );

    expect(result.acceptedAt).toBe("2026-09-17T13:00:01.000Z");
    expect(result.observation.method).toBe("POST");
    expect(result.evidence.should.status).toBe("UNKNOWN");
    expect(result.evidence.could.status).toBe("PARTIAL");
    expect(result.evidence.did.status).toBe("KNOWN");
    expect(result.evidence.did.value?.destinationPath).toBe("/collect");
    expect(JSON.stringify(result.evidence)).not.toContain("should-not-survive");
    expect(result.evidence.why.status).toBe("UNKNOWN");
  });

  it("rejects non-http destinations", () => {
    expect(() =>
      ingestBrowserObservation({
        ...observation,
        destinationUrl: "file:///tmp/private.txt",
      }),
    ).toThrow(/http or https/);
  });
});
