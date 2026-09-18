# Stage 9 — Verified Learning Loop

**Status:** COMPLETE — VERIFIED LEARNING CANDIDATE PASSES FROZEN GATE  
**Deterministic detector:** `stage7-v1-frozen` (unchanged)  
**Stage 8 analyst:** `stage8-v2` GPT-OSS 120B (unchanged)  
**Learning benchmark:** `stage9-learning-v1-frozen`  
**Model family:** multiclass logistic regression  
**Advisory labels only:** `REVIEW / OBSERVE / ABSTAIN`

Stage 9 adds a controlled learning loop without turning ThirdSight into a self-modifying enforcement system.

The loop is:

`ambiguous evidence -> human verified label -> PII-minimized learning row -> offline candidate training -> frozen held-out evaluation -> promote or reject`

The learned model never acquires `CONSTRAIN` or `ISOLATE` authority and cannot modify SHOULD / COULD / DID / WHY, Purpose Contracts, evidence history, or Stage 7 deterministic findings.

## Why this exists

ThirdSight already distinguishes deterministic enforcement from advisory reasoning. Stage 9 asks a narrower question:

> Can verified operational feedback improve advisory triage while preserving the deterministic safety boundary?

The implementation deliberately trains a small interpretable classifier rather than another LLM. This makes the learning loop fast enough to demonstrate live and simple enough to inspect.

## Data boundary

Human feedback stores only:

- evidence record ID;
- one advisory label: `REVIEW`, `OBSERVE`, or `ABSTAIN`;
- a structured feature vector derived from ThirdSight evidence;
- timestamp and source `HUMAN_VERIFIED`.

It does **not** persist raw customer payloads, cookies, request bodies, business-object hashes, or PII values.

A review is immutable by record ID. A second submission returns the original verified outcome instead of silently relabelling it.

## Feature space

The learning model uses boolean features derived from evidence semantics:

- managed environment;
- cross-origin / same-origin;
- authoritative or partial purpose evidence;
- authoritative or partial WHY evidence;
- integration identity resolved;
- browser-only coverage;
- static asset;
- new unresolved destination;
- visible data categories;
- strong first-party correlation;
- deterministic finding present;
- POST request.

Raw URLs and raw customer values are not model features.

## Training and benchmark separation

Synthetic seed corpus:

- **180** examples;
- scenario families include managed new destinations, missing WHY, missing contracts, partial purpose evidence, public runtime observations, approved opaque requests, first-party static traffic, and public static assets.

Frozen held-out benchmark:

- **96** cases;
- benchmark ID: `stage9-learning-v1-frozen`;
- never used as training data.

Human-verified feedback is appended to the seed corpus with a small weight increase so reviewer-confirmed outcomes can influence later candidates without dominating the seed distribution.

## Predeclared promotion gate

A candidate is promoted only when all conditions hold:

1. held-out accuracy improves over the fixed baseline;
2. review recall does not decline;
3. benign false-review rate does not increase;
4. authority violations remain zero;
5. harmful-response rate remains zero.

If a candidate fails, the latest previously promoted learned model remains active.

## First frozen evaluation

Workflow run: `35399106503`

| Metric | Baseline | Learned candidate |
| --- | ---: | ---: |
| Held-out cases | 96 | 96 |
| Accuracy | 87.50% | **90.625%** |
| Review recall | 66.67% | **91.67%** |
| Benign false-review rate | 0.00% | **0.00%** |
| Authority violations | 0 | **0** |
| Harmful-response rate | 0.00% | **0.00%** |

Result: **promotion gate passed**.

The improvement is intentionally described as held-out advisory classification performance, not as a generic security-detection accuracy claim.

## Product interaction

For an eligible ambiguous evidence record, the console now exposes:

1. **Verify outcome** — operator selects `REVIEW`, `OBSERVE`, or `ABSTAIN`;
2. **Train candidate** — server-side training combines the synthetic seed with verified feedback;
3. **Promotion gate** — candidate is evaluated on the frozen benchmark;
4. **Active learned advisory** — only a promoted model may surface a prediction.

Training is off the live deterministic decision path. The Stage 7 detector remains frozen and the Stage 8 AI authority boundary remains unchanged.

## Persistence

Supabase tables:

- `public.learning_feedback`
- `public.learning_model_runs`

Both have RLS enabled. Server-side access uses the existing ThirdSight service-role path; the browser never receives the service-role key.

## Reproducibility

Core implementation:

- `src/learning-loop/learning-loop.ts`
- `src/learning-loop/learning-loop.test.ts`
- `src/learning-loop/supabase-learning-store.ts`

Product APIs:

- `api/learning-review.ts`
- `api/learning-train.ts`
- `api/learning-status.ts`

UI:

- `src/app/LearningLoopPanel.tsx`

Evaluation:

- `scripts/stage9-learning-evaluation.ts`
- `.github/workflows/stage9-learning-evaluation.yml`

The evaluation workflow verifies the frozen Stage 7 detector hashes before running Stage 9 tests and benchmark evaluation.
