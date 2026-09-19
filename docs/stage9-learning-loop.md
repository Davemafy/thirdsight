# Stage 9 — Verified Learning

**Status:** IMPLEMENTED — RESIDUAL REVIEW-PRIORITY TARGET, PRODUCTION SEED PROMOTION PENDING  
**Product thesis:** **ThirdSight proves what can be proven, and learns where proof stops.**  
**Deterministic detector:** `stage7-v1-frozen` (unchanged)  
**Stage 8 analyst authority:** unchanged  
**Learning benchmark:** `stage9-review-priority-v2-frozen`  
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

A record is excluded when deterministic authority has already produced `CONSTRAIN`, `ISOLATE`, `PREVENTED`, or `DETECTED`.

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
- target is review priority, not enforcement action;
- all seed examples remain outside Stage 7 deterministic authority.

Frozen held-out benchmark:

- **96** residual third-party cases;
- benchmark ID: `stage9-review-priority-v2-frozen`;
- never used as training data;
- evaluates HIGH / MEDIUM / LOW review priority only.

Human-verified feedback is appended to the seed corpus with limited extra weight so confirmed outcomes can influence later candidates without dominating the synthetic prior.

## Predeclared promotion gate

A candidate is promoted only when all conditions hold:

1. held-out priority accuracy improves over the fixed non-learning review-priority baseline;
2. HIGH-priority recall does not decline;
3. LOW-priority cases falsely escalated to HIGH do not increase;
4. authority violations remain zero;
5. harmful-response rate remains zero.

A failed candidate is persisted as **REJECTED** and never displaces the latest promoted model.

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

No schema expansion was required for the v2 target. Existing model-run rows are versioned by benchmark ID, so the v1 classifier cannot be mistaken for an active v2 priority model.

Core implementation:

- `src/learning-loop/learning-loop.ts`
- `src/learning-loop/learning-loop.test.ts`
- `src/learning-loop/supabase-learning-store.ts`
- `api/learning.ts`
- `src/app/LearningLoopPanel.tsx`
- `scripts/stage9-learning-evaluation.ts`
- `.github/workflows/stage9-learning-evaluation.yml`

The Stage 9 evaluation workflow verifies the frozen Stage 7 Git blob hashes before evaluating Verified Learning.
