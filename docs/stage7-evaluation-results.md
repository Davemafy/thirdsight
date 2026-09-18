# Stage 7 frozen-detector evaluation

Detector freeze: `stage7-v1-frozen`

Frozen domain blobs:

- `src/domain/deterministic-verifier.ts` — `bcb18f5fa7e41083aca4208fc7c95bbb3288fa84`
- `src/domain/evidence-verification.ts` — `8ddc19fe96fd73111e7d047bd8367209d2659dcb`

The evaluation workflow verifies both Git blob hashes before running. No detector or evidence-projector changes are permitted after this freeze without creating a new detector version.

## Unseen seeds

`73013, 99173, 104729, 161803, 271828`

These seeds were introduced only after the detector freeze.

## Results

| Metric | Result |
| --- | ---: |
| Total cases | 392 |
| Legitimate cases | 255 |
| Unjustified cases | 137 |
| True positives | 123 |
| False positives | 0 |
| True negatives | 255 |
| False negatives | 14 |
| Precision | 1.000000 |
| Recall | 0.897810 |
| False-positive rate | 0.000000 |
| Legitimate traffic disrupted | 0 |
| Legitimate traffic disruption rate | 0.000000 |
| Preventable unnecessary-access cases | 46 |
| Unnecessary access prevented | 46 |
| Prevention rate for preventable cases | 1.000000 |
| Known blind-spot false negatives | 14 |

All 14 false negatives are the intentionally undetectable perfect-mimic benchmark: the hidden actor is compromised, but SHOULD, COULD, DID and WHY remain consistent with a legitimate request. ThirdSight does not claim to infer that hidden compromise.

The prevention metric counts only managed cases where the evaluation harness exercised a concrete pre-send payload constraint and received `PREVENTED`. Passive DB-audit detections, shadow observations and proportional-purpose findings are not relabelled as prevention merely because they were detected.

## Scenario families

- Legitimate flash-sale traffic remained ALLOW with matching business-object context.
- Proportional exfiltration was caught through object-level PURPOSE_MISMATCH even when aggregate request volume looked legitimate.
- Retired LegacyCRM direct database access produced STALE_INTEGRATION and ISOLATE; the observed read remains DETECTED, not PREVENTED.
- Opaque unregistered browser access produced SHADOW_INTEGRATION and OBSERVE while payload semantics stayed unknown.
- Purpose Contract v4 kept the new field out of scope; v5 approved it without rewriting historical evidence.
- Perfect-mimic compromise remained ALLOW and is reported as a known blind spot rather than a fabricated detection.
