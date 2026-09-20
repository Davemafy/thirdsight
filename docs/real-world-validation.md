# Real-world validation

**Status:** COMPLETE  
**Source benchmark:** [Stage 6 - 40-site Nigeria-facing passive discovery benchmark](stage6-ng40-benchmark.md)  
**Corrected workflow run:** `35470223205`  
**Benchmark run ID:** `ng40-1789852996559`

ThirdSight uses two deliberately different validation environments.

## 1. Commerce Lab - controlled proof

Commerce Lab supplies ground truth that public browsing cannot provide: explicit Purpose Contracts, declared capabilities, first-party business context and controlled misbehaviour.

That environment is where ThirdSight proves deterministic behavior:

- normal legitimate activity -> `ALLOW`;
- 10x legitimate flash-sale traffic with matching business objects -> `ALLOW` with no false alarm;
- proportional abuse during the same sale -> `PURPOSE_MISMATCH`;
- scope violation -> `SCOPE_DRIFT` -> `CONSTRAIN`;
- `customer.phone` removed before transmission while legitimate fields continue -> `PREVENTED`;
- opaque shadow integration -> deterministic proof stops at `OBSERVE`, allowing Verified Learning to prioritize human review without gaining enforcement authority.

Commerce Lab is therefore the evidence source for claims about correctness, abuse detection, graded response and prevention.

## 2. Public-site discovery - external breadth

The public benchmark asks a narrower question:

> Can ThirdSight passively discover and persist browser-visible cross-origin integration surfaces across a diverse set of real Nigeria-facing sites while preserving its visibility limits?

The corrected benchmark result is:

| Measure | Result |
| --- | ---: |
| Sites attempted | 40 |
| Sites loaded normally without bypass | 30 |
| Loaded sites with browser-visible cross-origin evidence | 30/30 |
| Representative observations persisted | 203 |
| Unique persisted cross-origin destination origins | 118 |
| Rows labelled PREVENTED or DETECTED | 0 |

Across all 203 persisted rows, the evidence semantics were exact:

| Evidence question | Public benchmark value |
| --- | --- |
| SHOULD | UNKNOWN - merchant Purpose Contract not provided |
| COULD | PARTIAL - browser-visible lower bound only |
| DID | KNOWN - observed request metadata |
| WHY | UNKNOWN - internal business justification unavailable |
| Coverage | BROWSER_ONLY |

The most repeated persisted destination origins included:

- `https://www.googletagmanager.com` - 20 sites;
- `https://fonts.googleapis.com` - 10 sites;
- `https://static.cloudflareinsights.com` - 9 sites;
- `https://connect.facebook.net` - 8 sites.

These are observed browser destination origins, not automatically asserted to be independent third-party companies.

## Safety boundary

The benchmark used public logged-out homepages only. It used isolated browser contexts and did not submit forms, authenticate, click through the sites, fuzz inputs, mutate requests, bypass anti-bot/access controls, inspect request bodies, inspect telemetry response bodies, or persist cookies, query strings, raw customer payloads or PII.

A block, timeout or challenge was treated as unavailable. The harness did not try a second technique to defeat it.

## Claim discipline

Public discovery does **not** establish:

- merchant intent or business justification;
- whether a destination is malicious, necessary or over-permissioned;
- backend permissions or database access;
- server-to-server activity;
- downstream vendor behavior.

Those claims require evidence that browser-only observation does not contain.

The combined validation story is therefore:

**Commerce Lab -> known ground truth, deterministic detection, prevention and false-positive proof.**

**40 public sites -> external discovery breadth with explicit UNKNOWN/PARTIAL limits.**

Together, they support the product thesis without collapsing discovery into enforcement:

**ThirdSight proves what can be proven, and learns where proof stops.**
