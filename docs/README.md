# Documentation

This directory contains the canonical product and implementation documents for ThirdSight.

## Current baseline

- [`architecture-v0.5.1.md`](architecture-v0.5.1.md) — frozen implementation baseline: thesis, evidence semantics, trust boundaries, authority model, response semantics, and declared limitations.
- [`demo-contract-v1.md`](demo-contract-v1.md) — required demo behavior, attack scenarios, evidence requirements, and acceptance gates.
- [`browser-evidence-adapter-v0.md`](browser-evidence-adapter-v0.md) — browser observation contract, feasibility results, privacy reduction, and evidence projection semantics.
- [`evidence-persistence-v0.md`](evidence-persistence-v0.md) — durable browser evidence history, exact-origin integration identity resolution, sensor authentication, and persistence failure semantics.
- [`stage7-evaluation.md`](stage7-evaluation.md) — completed controlled attack scenarios, frozen detector manifest, unseen-seed evaluation metrics, and declared perfect-mimic blind spot.
- [`stage8-ai-evaluation.md`](stage8-ai-evaluation.md) — AI authority boundary, the rejected local-model experiment, the fresh Groq AI OFF / AI ON evaluation, separate persistence, and the evidence-based advisory promotion decision.

## Document discipline

Architecture versions are immutable once superseded. Do not silently rewrite an older architecture version to reflect a new concept.

When an architectural invariant changes because implementation or evaluation produces contradictory evidence:

1. create a new versioned architecture document,
2. explain the reason for the change,
3. record the evidence or failing test that forced it,
4. update the README and demo contract if public behavior changed.

Research-derived observations may inform design, but raw HAR captures, credentials, and personal data must never be committed here.
