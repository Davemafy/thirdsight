import { describe, expect, it } from "vitest";

import {
  BrowserObservationValidationError,
  parseBrowserObservation,
  projectBrowserObservationToEvidenceGraph,
} from "./browser-evidence-adapter";

const BASE_OBSERVATION = {
  schemaVersion: "browser-observation.v1",
  observationId: "obs-001",
  sensorId: "chrome-extension:test",
  observedAt: "2026-09-17T12:23:00.000Z",
  pageUrl: "https://shop.example/products/desk-lamp?campaign=summer#details",
  destinationUrl:
    "https://analytics.example/event?email=customer%40example.com#ignored",
  method: "post",
  resourceType: "Fetch",
  initiatorType: "script",
  hasPostData: true,
} as const;

describe("browser evidence adapter", () => {
  it("projects passive browser traffic without inventing SHOULD or WHY", () => {
    const graph = projectBrowserObservationToEvidenceGraph(BASE_OBSERVATION);

    expect(graph.integrationResolution).toBe("UNRESOLVED");
    expect(graph.should.status).toBe("UNKNOWN");
    expect(graph.should.confidence).toBe("UNKNOWN");
    expect(graph.why.status).toBe("UNKNOWN");
    expect(graph.why.confidence).toBe("UNKNOWN");

    expect(graph.could.status).toBe("PARTIAL");
    expect(graph.could.confidence).toBe("OBSERVED_LOWER_BOUND");
    expect(graph.could.value?.destinationOrigin).toBe(
      "https://analytics.example",
    );

    expect(graph.did.status).toBe("KNOWN");
    expect(graph.did.confidence).toBe("OBSERVED");
    expect(graph.did.value).toMatchObject({
      boundary: "browser",
      phase: "ATTEMPTED",
      pageOrigin: "https://shop.example",
      destinationOrigin: "https://analytics.example",
      destinationPath: "/event",
      method: "POST",
      hasPostData: true,
      originRelationship: "CROSS_ORIGIN",
    });
  });

  it("drops query strings, fragments, and unknown raw payload fields", () => {
    const graph = projectBrowserObservationToEvidenceGraph({
      ...BASE_OBSERVATION,
      postData: {
        customer: {
          phone: "+2348000000000",
        },
      },
    });

    const serialized = JSON.stringify(graph);

    expect(serialized).not.toContain("customer%40example.com");
    expect(serialized).not.toContain("campaign=summer");
    expect(serialized).not.toContain("+2348000000000");
    expect(graph.did.value?.destinationPath).toBe("/event");
  });

  it("marks same-origin traffic without calling cross-origin ownership third-party", () => {
    const graph = projectBrowserObservationToEvidenceGraph({
      ...BASE_OBSERVATION,
      destinationUrl: "https://shop.example/api/catalog?sku=123",
    });

    expect(graph.did.value?.originRelationship).toBe("SAME_ORIGIN");
    expect(graph.did.value?.destinationOrigin).toBe("https://shop.example");
    expect(graph.did.value?.destinationPath).toBe("/api/catalog");
  });

  it("rejects unsupported schemas and non-http destinations", () => {
    expect(() =>
      parseBrowserObservation({
        ...BASE_OBSERVATION,
        schemaVersion: "browser-observation.v2",
      }),
    ).toThrow(BrowserObservationValidationError);

    expect(() =>
      parseBrowserObservation({
        ...BASE_OBSERVATION,
        destinationUrl: "file:///tmp/private.txt",
      }),
    ).toThrow("destinationUrl must use http or https");
  });
});
