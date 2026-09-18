# Stage 8 — AI Analyst Evaluation

**Status:** COMPLETE — AI NOT PROMOTED  
**Deterministic detector:** `stage7-v1-frozen` (unchanged)  
**AI analyst version:** `stage8-v1`  
**Evaluated model:** `onnx-community/Qwen2.5-0.5B-Instruct:q4`  
**Held-out ambiguous cases:** 12

Stage 8 tested whether an advisory AI layer improves genuinely ambiguous ThirdSight cases after the deterministic detector was frozen. It did not. The AI analyst therefore remains secondary and is not promoted into the primary console experience.

## Frozen deterministic boundary

Before every Stage 8 evaluation, CI verifies the exact Stage 7 blobs:

- `src/domain/deterministic-verifier.ts` — `bcb18f5fa7e41083aca4208fc7c95bbb3288fa84`
- `src/domain/evidence-verification.ts` — `8ddc19fe96fd73111e7d047bd8367209d2659dcb`

No Stage 8 change modified the deterministic detector, thresholds, finding taxonomy, evidence semantics, Purpose Contract behavior, or response rules.

## AI authority boundary

The analyst receives a PII-minimized structured projection of ThirdSight evidence. It does not receive raw customer payloads, raw business-object hashes, or raw provenance IDs.

The structured analyst output is:

- `assessment`
- `evidence_used`
- `unsupported_assumptions`
- `confidence`
- `recommended_response`
- `explanation`

Allowed recommendations are only:

- `OBSERVE`
- `REVIEW`
- `ABSTAIN`

The authority validator rejects attempts to widen contracts, invent permissions, cite unavailable evidence, independently `CONSTRAIN` or `ISOLATE`, alter SHOULD / COULD / DID / WHY, override deterministic findings, or relabel `DETECTED` / `PREVENTED`.

Rejected output is converted to a safe advisory `ABSTAIN`. It does not become a ThirdSight response.

## Persistence separation

Factual evidence remains in the existing evidence history.

AI material is persisted separately:

- `public.ai_assessments` — structured advisory assessments and authority-validation state;
- `public.ai_evaluation_runs` — AI OFF / AI ON comparison reports and the promotion decision.

This prevents model output from becoming factual evidence by storage convention.

## Held-out evaluation

The same 12 ambiguous cases were evaluated twice:

1. **AI OFF** — frozen deterministic system plus its existing ambiguity handling.
2. **AI ON** — the exact same cases plus the Stage 8 advisory model.

The cases include public browser discovery, managed unresolved destinations, weak temporal WHY correlation, missing business context, missing Purpose Contract, irrelevant same-origin traffic, opaque payload visibility, and partial capability evidence.

### Results

| Metric | AI OFF | AI ON | Delta |
| --- | ---: | ---: | ---: |
| Ambiguous-case handling rate | 50.00% | 0.00% | -50.00 pp |
| Unsupported-claim rate | 0.00% | 0.00% | 0.00 pp |
| Useful-review rate | 22.22% | 0.00% | -22.22 pp |
| Harmful-response rate | 0.00% | 0.00% | 0.00 pp |
| Abstention quality | 41.67% | 25.00% | -16.67 pp |
| Authority violations | 0 | 12 | +12 |
| Accepted AI assessments | — | 0 / 12 | — |

The AI model failed the advisory contract on all 12 held-out cases. Failures included malformed/non-JSON responses and assessment labels outside the allowed schema.

The important safety result is that **none of those failures escaped the authority boundary**. All 12 outputs were rejected and converted to safe abstention. That is why harmful-response rate remains 0% even though authority-violation count is 12.

The 0% unsupported-claim rate should not be interpreted as strong model performance: no model assessment was accepted. Unsupported claims were prevented from entering the product by the validation boundary.

## Promotion decision

`surface_prominently = false`

The measured AI layer made ambiguous-case handling worse, produced no useful accepted reviews, and reduced abstention quality. It therefore did not clear the promotion bar.

The primary ThirdSight console remains deterministic and evidence-first. The UI contains a promotion gate for advisory AI, but the persisted Stage 8 evaluation keeps that gate off. No AI assessment is shown prominently unless a future, independently held-out evaluation demonstrates a real improvement.

## Runtime and reproducibility

The evaluated model runs as a local open model in GitHub Actions, so the benchmark does not depend on a hidden model API key. The evaluation workflow:

- verifies the Stage 7 freeze hashes;
- runs the Stage 8 authority tests;
- executes the same held-out cases with AI OFF and AI ON;
- calculates the required metrics;
- obtains a short-lived GitHub OIDC credential;
- persists factual evidence and AI assessments separately through the Stage 8 ingestion boundary;
- uploads the evaluation artifact.

Workflow: `.github/workflows/stage8-ai-evaluation.yml`

The successful persisted evaluation run is:

`stage8-local-ai-1789738201154`

## Interpretation

Stage 8 does not demonstrate that AI improves ThirdSight today.

It demonstrates two narrower things:

1. ThirdSight can add an AI reasoning layer without granting that model security authority or allowing it to rewrite evidence.
2. The product is willing to reject the AI layer when measured results do not justify surfacing it.

That outcome is intentionally preserved rather than tuning the frozen detector or changing the evaluation after seeing the result.
