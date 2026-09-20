# Vendor Intelligence v2

**Status:** product capability  
**Registry version:** `vendor-intelligence-v2`  
**Reviewed:** 2026-09-20

## What changed from v1

v2 separates two things that must not be conflated:

1. **Origin coverage** — every one of the 3,354 unique origins from the reproducible 1,000-site browser benchmark is indexed exactly once.
2. **Documentation resolution** — only origins that can be tied to a documented product family with defensible vendor evidence receive Expected/Capable product context.

This means ThirdSight can truthfully claim **100% benchmark-origin inventory coverage** without claiming 100% vendor identity or documentation coverage.

The full generated manifest is published at:

`/vendor-intelligence/global1000-origins.json`

The compact generation report is:

`docs/vendor-intelligence-global1000-coverage.json`

Both are generated from the exact successful benchmark artifact rather than from a hand-copied list.

## Product evidence model

| Product question | Strongest source | Meaning |
| --- | --- | --- |
| Expected | Vendor documentation | What the resolved product family is documented to do |
| Approved | Merchant Purpose Contract | What this merchant authorized |
| Capable | Vendor documentation + merchant/local capability evidence | What the product can do, narrowed where local configuration is known |
| Observed | Runtime evidence | What ThirdSight actually saw happen |
| Context | First-party business event | What was happening in the customer journey |

Vendor documentation is supporting evidence. It never becomes merchant authorization.

## Full-origin disposition

Every benchmark origin receives `coverageState: INDEXED` and one reproducible namespace relationship:

- `SOURCE_NAMESPACE_ONLY` — the hostname equals or sits beneath the benchmark source domain on every site where it was observed.
- `MIXED_SOURCE_AND_EXTERNAL` — the same origin is source-namespace traffic on at least one benchmark site and external on another.
- `SHARED_EXTERNAL` — an external origin observed on multiple benchmark sites.
- `SINGLE_EXTERNAL` — an external origin observed on one benchmark site.

These labels are deliberately narrow. They do **not** assert corporate ownership, legal controller status, necessity, maliciousness or merchant approval.

At product runtime, documented Vendor Intelligence can upgrade an indexed entry to `DOCUMENTED_PRODUCT_FAMILY`. Otherwise the origin keeps its indexed relationship disposition and remains explicitly unresolved at the product-family layer.

## Documentation-backed registry

v2 contains the v1 families plus additional high-frequency endpoints supported by vendor documentation:

- Microsoft Advertising UET
- Adobe Experience Cloud identity / Audience Manager Demdex
- Akamai mPulse / Boomerang
- HubSpot tracking code
- TrustArc Cookie Consent Manager
- X Pixel
- Reddit Pixel
- Adobe Marketo Munchkin
- Tealium iQ Tag Management
- Optimizely Web Experimentation
- Amplitude Browser Analytics
- New Relic Browser Monitoring

The existing Google, Meta, OneTrust, Microsoft Clarity, Cloudflare, LinkedIn, Adobe Data Collection, TikTok, Cloudinary and Stripe families remain.

Every profile contains:
- exact or suffix hostname matchers;
- expected purposes;
- documented capabilities;
- documented event/data categories;
- vendor-published source URLs;
- a review date;
- limitations describing what the hostname cannot establish.

## Priority rule for unresolved origins

Unresolved origins are not discarded. The generated manifest preserves prevalence and example source sites.

Resolution work should therefore proceed in this order:

1. shared external origins with the highest site count;
2. mixed source/external origins;
3. single-site external origins;
4. source-namespace-only origins only when they materially affect an investigation.

That makes documentation work proportional to observed landscape importance instead of crawling documentation alphabetically.

## Frozen-proof compatibility

Vendor Intelligence v2 remains contextual enrichment.

It does not:
- overwrite frozen `SHOULD`;
- rewrite frozen `COULD`;
- manufacture `WHY`;
- change a deterministic finding;
- grant `CONSTRAIN` or `ISOLATE`;
- alter `PREVENTED` / `DETECTED` semantics.

The original 40-site and 1,000-site persisted records keep their original evidence semantics.

A future deterministic consumer of documented capability would require its own versioned acceptance and regression study against the frozen Stage 7 baseline.

## Reproducibility

The publisher downloads the successful Stage 6 global1000 artifact and runs:

```
node scripts/stage6-global1000-origin-coverage.mjs \
  /tmp/global1000/stage6-global1000-discovery.json \
  public/vendor-intelligence/global1000-origins.json \
  docs/vendor-intelligence-global1000-coverage.json
```

Generation fails if the number of unique indexed origins differs from the benchmark's `uniqueObservedCrossOriginOrigins` field.

The resulting manifest also contains a SHA-256 over the canonical origin entries so changes can be audited.
