# Browser evidence adapter v0

**Status:** implementation slice  
**Architecture baseline:** `architecture-v0.5.1.md`

This adapter promotes the browser feasibility spike into a production-facing evidence contract without changing the architecture invariants.

## What it accepts

The adapter accepts a deliberately small `browser-observation.v1` envelope:

```ts
{
  schemaVersion: "browser-observation.v1"
  observationId: string
  sensorId: string
  observedAt: string
  pageUrl: string | null
  destinationUrl: string
  method: string
  resourceType: string
  initiatorType: string
  hasPostData: boolean
}
```

It does **not** accept or persist arbitrary request bodies.

## Evidence mapping

A passive browser observation maps into the evidence graph conservatively:

- **SHOULD:** `UNKNOWN` — the browser sensor does not know the merchant's approved Purpose Contract.
- **COULD:** `PARTIAL / OBSERVED_LOWER_BOUND` — the runtime demonstrably executed a request toward the destination, but this is not the complete permission or capability surface.
- **DID:** `KNOWN / OBSERVED` — the browser sensor directly observed the outbound request metadata. The current adapter records the event as `ATTEMPTED`, not automatically as successfully transmitted or accepted.
- **WHY:** `UNKNOWN` — passive browser traffic does not provide authoritative first-party business context.

An unresolved destination is not automatically labelled as a third-party integration. The adapter records only `SAME_ORIGIN`, `CROSS_ORIGIN`, or `UNKNOWN`; ownership and integration identity require a separate resolver.

## Privacy boundary

The adapter intentionally stores origin and pathname only. Query strings, fragments, credentials embedded in URLs, and unknown input properties are dropped during projection. `hasPostData` records only whether a body existed.

This keeps real-site discovery useful without turning research traffic into a payload collection system.

## External feasibility evidence

The browser mechanism was exercised in GitHub-hosted Chromium before this adapter was created.

### Controlled Commerce Lab

The extension observed a JSON analytics request, paused it before delivery, removed `customer.phone`, continued the modified request, and the receiver reported that the phone field did not arrive. This supports a managed-browser `PREVENTED` path for the controlled JSON case.

### Jumia Nigeria

Passive attachment and observation worked, but the cloud runner received a Cloudflare `403` challenge. The run therefore proves the sensor could observe the browser session, not that it captured a representative normal Jumia shopping flow.

### Konga Nigeria

A public logged-out Konga session loaded with HTTP `200`. The extension captured 100 browser observations across 22 origins, including first-party Konga traffic and browser-visible origins associated with analytics, advertising, messaging/support, CDN, and API infrastructure. No login, checkout, form submission, personal data, request-body persistence, or request modification was used.

These observations are discovery evidence only. They do not establish whether any named service is inappropriate, over-privileged, or inconsistent with Konga's internal contracts.

## Next implementation boundary

The next slice should transport `browser-observation.v1` envelopes from the packaged extension into ThirdSight ingestion, then resolve integration identity and join merchant-provided Purpose Contracts and first-party business events. Managed Commerce Lab enforcement remains the safe place to demonstrate `CONSTRAIN -> PREVENTED` until a merchant explicitly authorises enforcement on its own site.
