# Stage 8 — AI Analyst Evaluation

**Status:** COMPLETE — ADVISORY AI PROMOTED  \
**Deterministic detector:** `stage7-v1-frozen` (unchanged)  \
**AI analyst version:** `stage8-v2`  \
**Evaluated model:** `openai/gpt-oss-120b@groq`  \
**Benchmark:** `stage8-fresh-v2`  \
**Fresh held-out ambiguous cases:** 16

Stage 8 tested whether an advisory AI layer improves genuinely ambiguous ThirdSight cases after the deterministic detector was frozen. The first small local-model experiment did not improve the product, so it was not promoted. A later provider experiment was evaluated on a new, separately frozen benchmark rather than reusing the already-seen cases. On that fresh benchmark, the Groq-hosted GPT-OSS 120B analyst cleared the existing promotion bar and is therefore allowed to surface as an advisory layer.

It still has **no enforcement authority**.

## Frozen deterministic boundary

Before every Stage 8 evaluation, CI verifies the exact Stage 7 blobs:

- `src/domain/deterministic-verifier.ts` — `bcb18f5fa7e41083aca4208fc7c95bbb3288fa84`
- `src/domain/evidence-verification.ts` — `8ddc19fe96fd73111e7d047bd8367209d2659dcb`

No Stage 8 change modified the deterministic detector, thresholds, finding taxonomy, evidence semantics, Purpose Contract behavior, or response rules.

The fresh AI benchmark is defined in `src/ai-analyst/fresh-ambiguous-v2.ts`. It was committed before the definitive successful model run. Subsequent fixes were transport-only: respecting Groq free-tier token limits, refreshing short-lived GitHub OIDC credentials across delayed batches, and registering the synthetic benchmark integration required by the existing persistence foreign key. The benchmark labels were not changed after seeing model outputs.

## AI authority boundary

The analyst receives a PII-minimized structured projection of ThirdSight evidence. It does not receive raw customer payloads, raw business-object hashes, raw cookies, form data, or raw provenance IDs.

The structured analyst output is:

- `assessment`
- `evidence_used`
- `unsupported_assumptions`
- `confidence`
- `recommended_response`
- `explanation`

Allowed recommendations remain only:

- `OBSERVE`
- `REVIEW`
- `ABSTAIN`

The model cannot independently `CONSTRAIN` or `ISOLATE`. It cannot widen a Purpose Contract, invent permissions, alter SHOULD / COULD / DID / WHY, override deterministic findings, or relabel `DETECTED` / `PREVENTED`.

Groq Strict Structured Outputs constrain the transport-level JSON shape. ThirdSight's own authority validator still runs afterward and remains the product security boundary.

## Persistence separation

Factual evidence remains in the existing evidence history.

AI material is persisted separately:

- `public.ai_assessments` — structured advisory assessments plus authority-validation state;
- `public.ai_evaluation_runs` — AI OFF / AI ON comparison reports plus the promotion decision.

Model output never becomes factual evidence by storage convention.

## Fresh held-out evaluation

The same 16 fresh ambiguous cases were evaluated twice:

1. **AI OFF** — frozen deterministic system plus existing ambiguity handling.
2. **AI ON** — the exact same cases plus the Stage 8 v2 advisory model.

The benchmark contains public cross-origin observations, managed unresolved integrations, missing Purpose Contracts, missing or weak WHY correlation, opaque browser payloads, partial capability evidence, same-origin static traffic, public CDN traffic, and new managed destinations.

### Definitive results

| Metric | AI OFF | AI ON | Delta |
| --- | ---: | ---: | ---: |
| Ambiguous-case handling rate | 43.75% | 56.25% | **+12.50 pp** |
| Unsupported-claim rate | 0.00% | 0.00% | 0.00 pp |
| Useful-review rate | 18.18% | 100.00% | **+81.82 pp** |
| Harmful-response rate | 0.00% | 0.00% | 0.00 pp |
| Abstention quality | 43.75% | 68.75% | **+25.00 pp** |
| Authority violations | 0 | 0 | 0 |
| Accepted AI assessments | — | **16 / 16** | — |

The definitive run accepted all 16 structured assessments. No model output crossed the authority boundary, no unsupported-claim pattern was detected by the evaluation harness, and no harmful response was produced.

The model is not perfect. It has a visible tendency to recommend `REVIEW` too often on irrelevant static or first-party traffic. That is why overall ambiguous-case handling is 56.25%, not close to 100%. Promotion means the analyst measurably improved the predeclared metrics while remaining advisory; it does **not** mean its recommendations are treated as ground truth.

## Promotion decision

`surface_prominently = true`

The predeclared promotion bar required all of the following:

- ambiguous-case handling improves;
- useful-review rate improves;
- unsupported-claim rate stays at or below 10%;
- harmful-response rate remains 0%;
- abstention quality does not decline.

The fresh Groq evaluation cleared every condition.

The primary ThirdSight decision path remains deterministic and evidence-first. The AI card may now surface for accepted assessments because the persisted evaluation gate is on, but AI recommendations remain secondary to deterministic findings and cannot trigger enforcement.

## Runtime and reproducibility

The definitive model path is:

`GitHub Actions -> short-lived GitHub OIDC -> Supabase Edge Function -> Groq -> GPT-OSS 120B -> strict JSON schema -> ThirdSight authority validator -> separate persistence`

The Groq API key is stored only as a Supabase Edge secret. It is not present in React, Vite, the browser extension, GitHub, or the repository.

The evaluation workflow:

- verifies the Stage 7 freeze hashes;
- runs the Stage 8 authority tests;
- evaluates the fresh benchmark with AI OFF and AI ON;
- sends only structured minimized evidence to the model;
- rate-limits itself to stay within the free Groq token budget;
- refreshes short-lived OIDC credentials between delayed batches;
- validates every model assessment locally;
- persists factual evidence and advisory assessments separately;
- uploads the evaluation artifact.

Workflow: `.github/workflows/stage8-ai-evaluation.yml`

Definitive successful workflow run:

`35375460642`

Persisted evaluation run:

`stage8-groq-ai-1789753443925`

Artifact:

- ID: `10560551245`
- SHA256: `97ba0aab3e6e97e42ba850898a53edba15c11c5ac7f0a5e4fec7bbdc24db6bc7`

## Earlier local-model experiment

The earlier `stage8-v1` experiment used `onnx-community/Qwen2.5-0.5B-Instruct:q4` on 12 different held-out cases. It failed the advisory contract on all 12 cases and was correctly not promoted.

That result is intentionally retained as evidence that ThirdSight does not surface an AI layer merely because one exists. The later Groq result used a **new unseen benchmark** rather than tuning against those 12 cases.

## Interpretation

Stage 8 now demonstrates three narrower claims:

1. ThirdSight can add AI reasoning without granting the model security authority or allowing it to rewrite evidence.
2. The product can reject a weak model and keep it out of the primary experience.
3. A stronger model can be promoted only after it improves a fresh held-out evaluation under the same authority constraints.

No architecture version bump was required because the evidence did not contradict the frozen architecture. The AI layer remains advisory and subordinate to ThirdSight's deterministic evidence model.
