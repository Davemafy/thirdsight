# Stage 9 — Verified Learning

**Status:** COMPLETE — FIRST HUMAN-VERIFIED LEARNING LOOP PASSED; v2 FAILURE RETAINED  
**Product thesis:** **ThirdSight proves what can be proven, and learns where proof stops.**  
**Deterministic detector:** `stage7-v1-frozen` (unchanged)  
**Stage 8 analyst authority:** unchanged  
**Learning benchmark:** `stage9-review-priority-v3-frozen`  
**Model family:** multiclass logistic regression  
**Learned output only:** `HIGH / MEDIUM / LOW REVIEW PRIORITY`

Verified Learning is not a second detector and it is not part of deterministic enforcement.

The product is intentionally split into two layers:

- **Proof layer** — reconstructs SHOULD / COULD / DID / WHY, produces deterministic findings, and retains all `ALLOW / CONSTRAIN / ISOLATE` authority plus the existing `PREVENTED / DETECTED` semantics.
- **Verified Learning layer** — activates only after deterministic verification stops with materially incomplete third-party evidence. It learns how strongly past verified outcomes suggest that the unresolved case deserves human review.

The product path is:

`Evidence -> Deterministic verification -> if unresolved -> Verified Learning -> Human review`

## What changed from Stage 9 v1

The first Stage 9 target classified `REVIEW / OBSERVE / ABSTAIN`. That was safe, but it was too close to imitating rule-like triage already encoded elsewhere in ThirdSight.

Stage 9 v2 changes only the learning target. It asks:

> Given that ThirdSight cannot prove this third-party case either safe or unjustified, how strongly does verified past experience suggest that a human should review it?

The model now outputs a review priority:

- **HIGH** — verified experience suggests this unresolved case deserves prompt human review;
- **MEDIUM** — the case remains unresolved and worth monitoring/review, but evidence does not support high urgency;
- **LOW** — the evidence is still incomplete, but verified patterns suggest low review priority.

A 0–100 advisory review score is derived from the learned HIGH / MEDIUM / LOW probabilities for display. It has no enforcement meaning.

## Eligibility boundary

Verified Learning is downstream of the proof layer.

A record is excluded when deterministic verification has already produced `ALLOW`, `CONSTRAIN`, `ISOLATE`, `PREVENTED`, or `DETECTED`. Verified Learning begins only when the deterministic layer stops unresolved (or explicitly at `OBSERVE`).

A record may enter Verified Learning only when it is third-party-like (`CROSS_ORIGIN` or deterministic `OBSERVE`) and proof remains incomplete, for example:

- Purpose Contract is UNKNOWN or PARTIAL;
- business justification is UNKNOWN or PARTIAL;
- integration identity is unresolved;
- visibility is browser-only;
- technical capability is only a lower bound;
- deterministic verification stops at OBSERVE because semantics cannot be proven.

This means the model is trained on the **residual uncertainty**, not on the deterministic cases ThirdSight already knows how to handle.

## Human feedback contract

Human review remains immutable by evidence record ID and stores only:

- evidence record ID;
- one human-confirmed advisory outcome: `REVIEW`, `OBSERVE`, or `ABSTAIN`;
- a PII-minimized residual-evidence feature vector;
- timestamp and source `HUMAN_VERIFIED`.

For learning, these confirmed outcomes map to review priority:

- `REVIEW -> HIGH`
- `OBSERVE -> MEDIUM`
- `ABSTAIN -> LOW`

No raw request body, customer value, cookie, business-object hash, or PII value is persisted as a learning feature.

## Residual feature space

The model uses only coarse evidence-state features:

- managed environment;
- cross-origin observation;
- purpose UNKNOWN / PARTIAL;
- WHY UNKNOWN / PARTIAL;
- integration identity unresolved;
- browser-only coverage;
- static-resource signal;
- presence of visible data categories;
- strong first-party correlation;
- deterministic OBSERVE;
- POST request.

These features describe evidence completeness and review context. They do not widen the Purpose Contract or infer facts that are absent from evidence.

## Training and benchmark separation

Synthetic seed corpus:

- **180** residual third-party examples;
- includes explicit deterministic-OBSERVE residual cases so every retained feature has training coverage;
- target is review priority, not enforcement action;
- all seed examples remain outside Stage 7 deterministic authority.

Frozen held-out benchmark:

- **96** residual third-party cases;
- benchmark ID: `stage9-review-priority-v3-frozen`;
- never used as training data;
- evaluates HIGH / MEDIUM / LOW review priority only.

Human-verified feedback is appended to the seed corpus with limited extra weight so confirmed outcomes can influence later candidates without dominating the synthetic prior.

## v2 failure retained

The first residual-priority seed candidate was evaluated in Quality workflow run `35414672524`.

It **did not pass** the v2 promotion gate. The learned candidate tied the fixed review-priority baseline on the frozen v2 benchmark, so the strict requirement that priority accuracy improve was not met. ThirdSight therefore rejected the candidate.

The failure exposed a training-coverage defect: `deterministicObserve` was present in the residual feature space but absent from every synthetic seed family, so the model could not learn from that signal.

The gate was not loosened and the v2 benchmark is now considered seen. The seed corpus was corrected by replacing a duplicate LOW-priority family with a HIGH-priority deterministic-OBSERVE residual family. Promotion is evaluated only on the new `stage9-review-priority-v3-frozen` benchmark.

## Predeclared promotion gate

A candidate is promoted only when all conditions hold:

1. held-out priority accuracy improves over the fixed non-learning review-priority baseline;
2. HIGH-priority recall does not decline;
3. LOW-priority cases falsely escalated to HIGH do not increase;
4. authority violations remain zero;
5. harmful-response rate remains zero.

A failed candidate is persisted as **REJECTED** and never displaces the latest promoted model.

## Fresh v3 evaluation

Quality workflow run `35414867673` evaluated the corrected seed learner on the separately frozen `stage9-review-priority-v3-frozen` benchmark.

| Metric | Fixed non-learning baseline | Learned candidate |
| --- | ---: | ---: |
| Held-out residual cases | 96 | 96 |
| Review-priority accuracy | 84.375% | **87.50%** |
| HIGH-priority recall | 58.3333% | **66.6667%** |
| LOW falsely escalated to HIGH | 0.00% | **0.00%** |
| Authority violations | 0 | **0** |
| Harmful-response rate | 0.00% | **0.00%** |

Result: **PROMOTED**.

Production active seed model:

- model version: `stage9-priority-v3-h0`;
- algorithm: `multiclass-logistic-regression-review-priority-v3`;
- training rows: **180 synthetic residual cases**;
- human-verified rows: **0** at promotion time;
- benchmark: `stage9-review-priority-v3-frozen`.

The seed model was intentionally promoted with zero human feedback. ThirdSight did not fabricate reviewer input.

## First human-verified learning loop

The first real operator-confirmed example used the controlled Commerce Lab opaque-shadow scenario:

- record: `browser:commerce-lab:shadow-pixel:shadow-pixel-1789732087645`;
- deterministic finding: `SHADOW_INTEGRATION`;
- deterministic result: `OBSERVE`;
- integration identity: `UNRESOLVED`;
- SHOULD: `UNKNOWN`;
- COULD: `PARTIAL`;
- DID: `KNOWN`;
- WHY: `UNKNOWN`;
- human-confirmed outcome: **REVIEW**;
- stored learning target: **HIGH REVIEW PRIORITY**.

The verified example was appended immutably as `HUMAN_VERIFIED`, raising the human-feedback count from **0 to 1**.

A new candidate, `stage9-priority-v3-h1`, was trained with the same algorithm and evaluated against the unchanged `stage9-review-priority-v3-frozen` 96-case benchmark. No threshold, label, benchmark, or promotion rule was changed after seeing the result.

| Metric | Fixed non-learning baseline | h0 seed model | h1 after 1 verified review |
| --- | ---: | ---: | ---: |
| Review-priority accuracy | 84.375% | 87.50% | **95.8333%** |
| HIGH-priority recall | 58.3333% | 66.6667% | **88.8889%** |
| LOW falsely escalated to HIGH | 0.00% | 0.00% | **0.00%** |
| Authority violations | 0 | 0 | **0** |
| Harmful-response rate | 0.00% | 0.00% | **0.00%** |

Result: **PROMOTED**.

For the reviewed shadow case itself, the active advisory score moved from approximately **81/100 HIGH** under `h0` to **97/100 HIGH** under `h1`. The deterministic result remained `OBSERVE`; only review priority changed.

The active production model is now:

- `stage9-priority-v3-h1`;
- **183 weighted training rows** = 180 synthetic seed rows + one human-verified row with the pre-existing 3× human-example weight;
- **1 human-verified example**;
- benchmark: `stage9-review-priority-v3-frozen`;
- status: **PROMOTED**.

This is the first end-to-end proof of the intended loop: deterministic proof stopped, Verified Learning prioritized the unresolved case, a human confirmed the outcome, a new candidate retrained offline, the same frozen gate evaluated it, and promotion occurred without changing deterministic enforcement.

## Authority boundary

Verified Learning may:

- output HIGH / MEDIUM / LOW review priority;
- rank unresolved cases for human attention;
- learn from immutable human-confirmed outcomes;
- train candidates offline;
- pass or fail a frozen promotion gate.

Verified Learning may never:

- output or execute `CONSTRAIN` or `ISOLATE`;
- change the deterministic result;
- change SHOULD / COULD / DID / WHY;
- invent Purpose Contracts or permissions;
- relabel `PREVENTED` / `DETECTED`;
- rewrite persisted evidence;
- override Stage 7 or Stage 8 authority rules.

**Advisory only — deterministic enforcement unchanged.**

## Product interaction

For an eligible unresolved record the console shows:

- the unchanged deterministic result;
- why proof stopped and the record entered Verified Learning;
- learned review priority and 0–100 advisory score;
- human-confirmed outcome;
- human-verified example count;
- candidate model version;
- frozen benchmark result;
- `PROMOTED` or `REJECTED`;
- the explicit advisory-only authority statement.

The intended judge flow is:

`normal legitimate traffic -> deterministic ALLOW`

`scope violation -> deterministic CONSTRAIN / PREVENTED`

`ambiguous third-party evidence -> Verified Learning priority -> human confirmation -> verified example append -> offline retrain -> frozen gate -> promote/reject`

## Persistence and reproducibility

Existing Stage 9 persistence is retained:

- `public.learning_feedback`
- `public.learning_model_runs`

No schema expansion was required for the review-priority target. Existing model-run rows are versioned by benchmark ID, so the old v1 triage classifier and rejected v2 experiment cannot be mistaken for the active v3 priority model.

Core implementation:

- `src/learning-loop/learning-loop.ts`
- `src/learning-loop/learning-loop.test.ts`
- `src/learning-loop/supabase-learning-store.ts`
- `api/learning.ts`
- `src/app/LearningLoopPanel.tsx`
- `scripts/stage9-learning-evaluation.ts`
- `.github/workflows/stage9-learning-evaluation.yml`

The Stage 9 evaluation workflow verifies the frozen Stage 7 Git blob hashes before evaluating Verified Learning.
