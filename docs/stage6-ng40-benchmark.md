# Stage 6 — 40-site Nigeria-facing passive discovery benchmark

**Status:** COMPLETE  
**Corrected run:** GitHub Actions `35470223205`  
**Benchmark run ID:** `ng40-1789852996559`  
**Mode:** public, logged-out, passive homepage discovery  
**Evidence destination:** existing `public.browser_evidence_history` pipeline

## Result

ThirdSight attempted 40 Nigeria-facing commerce, fintech, merchant-platform and logistics websites.

- **40** sites attempted
- **30** loaded normally without bypass
- **10** were blocked, timed out or otherwise unavailable from the runner
- **30/30 loaded sites** produced browser-visible cross-origin evidence
- **203** representative observations persisted into ThirdSight
- **118** unique persisted cross-origin destination origins

The database verification for the 203 benchmark rows is exact:

- `SHOULD = UNKNOWN`: **203/203**
- `COULD = PARTIAL`: **203/203**
- `DID = KNOWN`: **203/203**
- `WHY = UNKNOWN`: **203/203**
- `coverage = BROWSER_ONLY`: **203/203**
- rows carrying `PREVENTED` or `DETECTED` outcomes: **0**

This is a discovery-breadth result, not proof of merchant intent, backend permissions, compromise or abuse.

## Safety boundary

The harness deliberately does less than a normal interactive user:

- public pages only;
- logged out;
- homepage navigation only;
- isolated browser context per site;
- no forms submitted;
- no authentication;
- no clicks required by the benchmark;
- no fuzzing;
- no request mutation;
- no CAPTCHA, anti-bot, access-control or rate-limit bypass;
- no request bodies inspected;
- no response bodies inspected for telemetry;
- no cookies, query strings, raw customer payloads or PII persisted.

A non-success response, timeout or bot challenge is recorded as unavailable. The harness does not try a second technique to defeat it.

## Public-site evidence semantics

| Question | ThirdSight answer |
| --- | --- |
| SHOULD | Not provided / UNKNOWN |
| COULD | Partial / browser-visible lower bound |
| DID | Observed request metadata |
| WHY | Not available / UNKNOWN |
| Coverage | Browser only |
| Enforcement | None |

ThirdSight does **not** infer the merchant's Purpose Contract, internal business justification, backend permissions, server-to-server activity, database access, vendor intent or downstream vendor behavior from these observations.

## Coverage by category

| Category | Attempted | Loaded | With evidence | Persisted |
| --- | ---: | ---: | ---: | ---: |
| b2b-commerce | 3 | 3 | 3 | 20 |
| consumer-electronics | 4 | 3 | 3 | 18 |
| consumer-fintech | 6 | 5 | 5 | 30 |
| food-commerce-delivery | 2 | 2 | 2 | 16 |
| logistics-delivery | 4 | 3 | 3 | 20 |
| merchant-commerce | 2 | 1 | 1 | 8 |
| payments-fintech | 7 | 6 | 6 | 35 |
| retail | 5 | 3 | 3 | 24 |
| retail-grocery | 4 | 3 | 3 | 24 |
| retail-marketplace | 3 | 1 | 1 | 8 |

## Most repeated persisted cross-origin destinations

These are browser-visible destination origins, **not automatically asserted to be independent third-party companies**.

| Destination origin | Sites |
| --- | ---: |
| `https://www.googletagmanager.com` | 20 |
| `https://fonts.googleapis.com` | 10 |
| `https://static.cloudflareinsights.com` | 9 |
| `https://connect.facebook.net` | 8 |
| `https://fonts.gstatic.com` | 8 |
| `https://www.google.com` | 7 |
| `https://analytics.google.com` | 6 |
| `https://res.cloudinary.com` | 5 |
| `https://cdnjs.cloudflare.com` | 4 |
| `https://stats.g.doubleclick.net` | 4 |
| `https://www.google-analytics.com` | 4 |

## Per-site result

| Site | Category | HTTP | Loaded | Unique cross-origin origins | Persisted |
| --- | --- | ---: | --- | ---: | ---: |
| Jumia Nigeria | retail-marketplace | 403 | no | 0 | 0 |
| Konga | retail-marketplace | 200 | yes | 39 | 8 |
| Jiji Nigeria | retail-marketplace | 403 | no | 0 | 0 |
| Slot | retail | 200 | yes | 9 | 8 |
| Pointek | retail | 403 | no | 0 | 0 |
| Kara | retail | 403 | no | 0 | 0 |
| Fouani | retail | 200 | yes | 10 | 8 |
| iStore Nigeria | retail | 200 | yes | 34 | 8 |
| Supermart.ng | retail-grocery | 200 | yes | 24 | 8 |
| Market Square Nigeria | retail-grocery | 200 | yes | 10 | 8 |
| Shoprite Nigeria | retail-grocery | — | no | 0 | 0 |
| SPAR Nigeria | retail-grocery | 200 | yes | 18 | 8 |
| Oraimo Nigeria | consumer-electronics | 403 | no | 0 | 0 |
| Samsung Africa / Nigeria-facing | consumer-electronics | 200 | yes | 14 | 8 |
| TECNO Nigeria | consumer-electronics | 200 | yes | 10 | 8 |
| Infinix Nigeria | consumer-electronics | 200 | yes | 2 | 2 |
| Paystack | payments-fintech | 403 | no | 0 | 0 |
| Flutterwave Nigeria | payments-fintech | 200 | yes | 5 | 5 |
| Moniepoint Nigeria | payments-fintech | 200 | yes | 18 | 8 |
| OPay | payments-fintech | 200 | yes | 3 | 3 |
| PalmPay | payments-fintech | 200 | yes | 4 | 4 |
| Interswitch | payments-fintech | 200 | yes | 16 | 8 |
| Remita | payments-fintech | 200 | yes | 7 | 7 |
| Cowrywise | consumer-fintech | 405 | no | 2 | 0 |
| PiggyVest | consumer-fintech | 200 | yes | 4 | 4 |
| Risevest | consumer-fintech | 200 | yes | 25 | 8 |
| Kuda | consumer-fintech | 200 | yes | 8 | 8 |
| FairMoney | consumer-fintech | 200 | yes | 2 | 2 |
| Carbon | consumer-fintech | 200 | yes | 15 | 8 |
| Bumpa | merchant-commerce | 200 | yes | 19 | 8 |
| Selar | merchant-commerce | 403 | no | 1 | 0 |
| Sabi | b2b-commerce | 200 | yes | 4 | 4 |
| OmniRetail | b2b-commerce | 200 | yes | 12 | 8 |
| TradeDepot | b2b-commerce | 200 | yes | 14 | 8 |
| GIG Logistics | logistics-delivery | 200 | yes | 5 | 5 |
| Sendbox | logistics-delivery | 200 | yes | 7 | 7 |
| Kwik | logistics-delivery | 200 | yes | 10 | 8 |
| Chowdeck | food-commerce-delivery | 200 | yes | 10 | 8 |
| Glovo Nigeria | food-commerce-delivery | 202 | yes | 15 | 8 |
| DHL Nigeria | logistics-delivery | — | no | 0 | 0 |

## Reproducibility and failure record

The first execution, run `35470022761`, successfully collected public browser metadata but failed to persist it because the benchmark script referenced its OIDC token cache before that variable had been initialized.

That run is retained as a failed engineering run. The only fix was moving token initialization before the worker pool. The 40-site list, browser policy, evidence semantics, limits and safety boundary were unchanged.

The corrected run `35470223205` completed successfully and produced the results above.

## Interpretation

The result supports a narrow claim:

> ThirdSight can passively discover and persist browser-visible cross-origin integration surfaces across a diverse set of real Nigeria-facing public sites while explicitly preserving its visibility limits.

It does **not** prove those destinations are malicious, unnecessary, over-privileged or even organizationally third-party. Commerce Lab remains the controlled ground-truth environment for those claims, including abuse detection, prevention and false-positive evaluation.
