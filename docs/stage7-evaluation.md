# Stage 7 — Controlled Commerce Lab Attack Evaluation

**Status:** COMPLETE  
**Detector freeze:** `stage7-v1-frozen`  
**Evaluation freeze manifest:** `docs/detector-freeze-v1.json`

Stage 7 expands Commerce Lab one scenario at a time. Each scenario was introduced as a failing automated test, implemented with the minimum additional domain/runtime capability required, persisted into the existing evidence pipeline, and only then exposed to product UI or live proof workflows.

## Scenario order and result

| Scenario | Expected behavior | Result |
| --- | --- | --- |
| 10× legitimate flash sale | matching business objects → `ALLOW` → no false alarm | PASS |
| proportional abuse hidden inside sale | aggregate volume remains plausible, business-object correlation fails → `PURPOSE_MISMATCH` → `CONSTRAIN` | PASS |
| stale CRM direct DB access | retired integration is observed through DB audit → `STALE_INTEGRATION` → `ISOLATE`; already-observed read remains `DETECTED` | PASS |
| opaque shadow integration | unregistered managed-environment cross-origin destination → `SHADOW_INTEGRATION` → `OBSERVE`; payload semantics remain unknown | PASS |
| Purpose Contract version change | historical observation binds to v4; post-change observation binds to v5 | PASS |
| perfect mimic | purpose-consistent compromised actor remains `ALLOW`; limitation recorded explicitly as `PERFECT_MIMIC_UNDETECTABLE` | PASS / KNOWN BLIND SPOT |

The first two scenarios close Acceptance Gate 5.

## Acceptance Gate 5

The live proofs established both sides of the gate:

- legitimate sale traffic scaled to 10× without a false alarm;
- proportional abuse preserved normal aggregate volume but used unrelated business-object references;
- the deterministic detector ignored volume as a sufficient signal and caught the object-level mismatch instead.

This prevents a busy sales day from being treated as inherently suspicious.

## Frozen detector

After all six scenarios passed individually, the deterministic detector and evidence projector were frozen.

Frozen blobs:

- `src/domain/deterministic-verifier.ts` — `bcb18f5fa7e41083aca4208fc7c95bbb3288fa84`
- `src/domain/evidence-verification.ts` — `8ddc19fe96fd73111e7d047bd8367209d2659dcb`

The evaluation workflow verifies these hashes before running. A hash mismatch invalidates the evaluation rather than silently evaluating a post-hoc modified detector.

## Unseen-seed evaluation

Evaluation seeds:

`73013, 99173, 104729, 161803, 271828`

Total evaluated cases: **392**

| Metric | Result |
| --- | ---: |
| Legitimate cases | 255 |
| Unjustified cases | 137 |
| True positives | 123 |
| False positives | 0 |
| True negatives | 255 |
| False negatives | 14 |
| Precision | 100% |
| Recall | 89.781% |
| False-positive rate | 0% |
| Legitimate traffic disrupted | 0 |
| Legitimate traffic disruption rate | 0% |
| Preventable unnecessary accesses | 46 |
| Unnecessary accesses prevented | 46 |
| Unnecessary access prevention rate | 100% |
| Known blind-spot false negatives | 14 |

All 14 false negatives are the intentionally declared perfect-mimic family. They are not hidden by the evaluation. The benchmark ground truth knows the actor is compromised, while ThirdSight receives evidence that is otherwise indistinguishable from a legitimate, purpose-consistent request.

## Evaluation family breakdown

| Family | Cases | Violations | Detections | Disruptions | Prevented |
| --- | ---: | ---: | ---: | ---: | ---: |
| flash-sale legitimate | 235 | 0 | 0 | 0 | 0 |
| proportional exfiltration | 47 | 47 | 47 | 0 | 0 |
| managed preventable field drift | 26 | 26 | 26 | 0 | 26 |
| stale CRM direct DB | 12 | 12 | 12 | 0 | 0 |
| opaque shadow integration | 18 | 18 | 18 | 0 | 0 |
| contract post-change legitimate | 20 | 0 | 0 | 0 | 0 |
| managed preventable contract pre-change | 20 | 20 | 20 | 0 | 20 |
| perfect mimic known blind spot | 14 | 14 | 0 | 0 | 0 |

## Interpretation boundaries

The evaluation does **not** claim that ThirdSight detects every compromised third party.

It supports the narrower conclusions that:

1. legitimate high-volume commerce activity is not itself treated as abuse;
2. object-level purpose mismatch can expose proportional misuse that aggregate volume misses;
3. stale integration use can be detected at a DB-audit boundary and future credential use can be isolated;
4. unmanaged browser destinations can be surfaced without inventing payload semantics;
5. historical policy evaluation remains tied to the Purpose Contract version active at observation time;
6. a perfect mimic remains a declared limitation when the observable evidence is identical to legitimate use.

The frozen evaluation artifact is produced by `.github/workflows/stage7-evaluation.yml`.
