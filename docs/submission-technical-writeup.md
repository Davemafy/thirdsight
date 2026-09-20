# ThirdSight - Technical Submission Write-up

**ICSC 2026 Track G: Commerce & Consumer Protection - Watching What Third Party Integrations Really Do**

## 1. Problem and thesis

Commerce platforms depend on analytics, CRM, payment, marketing and logistics integrations that can accumulate access over time. A dashboard that only lists installed vendors cannot answer the operational question that matters: **is this integration still doing what the business approved it to do, and what should happen when the evidence no longer lines up?**

ThirdSight is an evidence-first prototype for continuous third-party access verification.

Its thesis is:

> **ThirdSight proves what can be proven, and learns where proof stops.**

The system deliberately separates a deterministic **Proof layer** from a downstream **Verified Learning layer**. The Proof layer owns all enforcement. Verified Learning only prioritizes unresolved cases for human review.

## 2. Evidence model and authority boundary

Every integration record is reconstructed around four independent questions:

- **SHOULD** - what the integration is approved to access for its declared business purpose;
- **COULD** - what its technical capability or permissions allow;
- **DID** - what runtime sensors actually observed;
- **WHY** - the trusted first-party business event that justifies the access.

Missing evidence remains UNKNOWN or PARTIAL. ThirdSight does not fill gaps with model inference.

The frozen Stage 7 deterministic verifier compares these dimensions and applies the smallest justified response:

`ALLOW -> OBSERVE -> CONSTRAIN -> ISOLATE`.

It also preserves the distinction between **PREVENTED** and **DETECTED**. A managed inline boundary may remove an unjustified field before transmission and prove prevention. Passive browser or database sensors can prove observation/detection, but they do not retroactively turn observed access into prevention.

Stage 8 adds an AI analyst that can explain structured evidence and recommend `OBSERVE / REVIEW / ABSTAIN`. It cannot alter evidence, Purpose Contracts, deterministic findings or enforcement.

Stage 9 Verified Learning activates only after deterministic proof stops with genuinely incomplete evidence. It predicts only **HIGH / MEDIUM / LOW review priority**. It cannot output or execute `CONSTRAIN` or `ISOLATE`.

## 3. Controlled validation - Commerce Lab

Commerce Lab is the controlled environment where the ground truth is known.

The judge path demonstrates six behaviors.

**Normal legitimate traffic.** Approved scope, runtime behavior and first-party business context agree, so ThirdSight returns `ALLOW`.

**Managed scope violation.** A request includes `customer.phone` outside the Purpose Contract. The deterministic verifier emits `SCOPE_DRIFT`, the managed boundary applies `CONSTRAIN`, the phone field is removed, legitimate fields continue, and the receiver record proves the forbidden field never arrived. The outcome is `PREVENTED`.

**Busy legitimate sale.** Traffic increases by 10x, but requests continue to correlate with first-party business objects. ThirdSight returns `ALLOW` and the stored proof reports no false alarm.

**Proportional abuse inside the same sale.** Aggregate volume still looks plausible, so a volume-only detector could miss it. ThirdSight checks business-object correlation; when that justification fails it emits `PURPOSE_MISMATCH`.

**Ambiguous shadow integration.** Browser evidence shows an unresolved cross-origin destination, but SHOULD and WHY remain unknown and COULD is only partial. Deterministic proof stops at `OBSERVE`. This is the handoff point to Verified Learning.

**Known blind spot.** The frozen evaluation also retains a perfect-mimic case where SHOULD, COULD, DID and WHY all remain consistent even though a hidden actor is compromised. ThirdSight does not claim to detect facts absent from its evidence.

## 4. Verified Learning - learning only on residual uncertainty

The first genuine human-feedback loop used the controlled opaque-shadow case:

`browser:commerce-lab:shadow-pixel:shadow-pixel-1789732087645`.

Before learning, the deterministic result was `OBSERVE`. The operator supplied the human-confirmed outcome `REVIEW`, persisted as `HUMAN_VERIFIED` and mapped to **HIGH REVIEW PRIORITY**.

The candidate changed from `stage9-priority-v3-h0` to `stage9-priority-v3-h1`. The same frozen 96-case residual benchmark and predeclared promotion gate were reused.

| Metric | Baseline | h0 | h1 |
| --- | ---: | ---: | ---: |
| Review-priority accuracy | 84.375% | 87.50% | 95.833% |
| HIGH-priority recall | 58.33% | 66.67% | 88.89% |
| LOW -> false HIGH | 0% | 0% | 0% |
| Authority violations | 0 | 0 | 0 |
| Harmful responses | 0% | 0% | 0% |

The candidate passed and was promoted. For the reviewed shadow case, the advisory score moved from about 81/100 HIGH to 97/100 HIGH.

Critically, the deterministic result remained `OBSERVE` before and after learning. The learned effect was **"review this unresolved pattern more strongly"**, not **"block it."**

This 95.833% result is a frozen synthetic residual-benchmark result after one verified human example. It is not evidence of broad real-world generalization.

## 5. Real-world public discovery - 40 Nigeria-facing sites

Controlled proof alone does not show that the observation pipeline works beyond the lab. ThirdSight therefore ran a passive, logged-out benchmark across 40 Nigeria-facing commerce, fintech, merchant-platform and logistics sites.

The corrected run attempted **40** sites. **30** loaded normally without bypass; **10** were blocked, timed out or unavailable from the runner. **30/30 loaded sites** produced browser-visible cross-origin evidence. ThirdSight persisted **203 representative observations** covering **118 unique cross-origin destination origins**.

For all 203 rows:

- SHOULD = UNKNOWN;
- COULD = PARTIAL;
- DID = KNOWN / observed;
- WHY = UNKNOWN;
- coverage = BROWSER_ONLY;
- PREVENTED or DETECTED outcomes = 0.

This is intentionally a discovery-breadth result. The public harness used homepages only, no accounts, no form submission, no fuzzing, no bypassing controls, no request mutation, no body inspection and no private/customer data.

ThirdSight does not infer merchant Purpose Contracts, internal justification, backend permissions, database access, server-to-server activity, malicious intent or downstream vendor behavior from these observations.

The two validation environments therefore complement rather than substitute for each other:

- **Commerce Lab:** ground-truth correctness, attack detection, graded response, prevention and false-positive proof.
- **Public benchmark:** external discovery breadth under honest browser-only visibility limits.

## 6. Reproducibility and submission claim

The deterministic Stage 7 detector is frozen as `stage7-v1-frozen`; its declared semantics and hashes are not changed by this submission packaging work. Stage 8 remains closed. Stage 9 uses the frozen `stage9-review-priority-v3-frozen` benchmark for promotion.

The 40-site corrected workflow is GitHub Actions run `35470223205`, benchmark ID `ng40-1789852996559`. The original failed engineering run is retained; the correction only moved OIDC token-cache initialization before the worker pool and did not change the site list, browser policy, evidence semantics, limits or safety boundary.

The defensible final claim is:

> ThirdSight can prove deterministic third-party policy violations and prevention when authoritative evidence exists; when proof remains incomplete, it preserves that uncertainty, prioritizes human review from verified outcomes without changing enforcement, and can passively discover browser-visible integration surfaces across real public sites without pretending that browser telemetry reveals internal merchant intent.

**ThirdSight proves what can be proven, and learns where proof stops.**
