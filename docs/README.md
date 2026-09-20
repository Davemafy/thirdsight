# Documentation

This directory contains the canonical product, validation and submission documents for ThirdSight.

## Current baseline

- [`architecture-v0.5.1.md`](architecture-v0.5.1.md) - frozen implementation baseline: thesis, evidence semantics, trust boundaries, authority model, response semantics and declared limitations.
- [`demo-contract-v1.md`](demo-contract-v1.md) - required demo behavior, attack scenarios, evidence requirements and acceptance gates.
- [`browser-evidence-adapter-v0.md`](browser-evidence-adapter-v0.md) - browser observation contract, feasibility results, privacy reduction and evidence projection semantics.
- [`evidence-persistence-v0.md`](evidence-persistence-v0.md) - durable browser evidence history, exact-origin integration identity resolution, sensor authentication and persistence failure semantics.
- [`stage7-evaluation.md`](stage7-evaluation.md) - completed controlled attack scenarios, frozen detector manifest, unseen-seed evaluation metrics and declared perfect-mimic blind spot.
- [`stage6-ng40-benchmark.md`](stage6-ng40-benchmark.md) - 40-site Nigeria-facing public discovery benchmark, safety boundary, persisted evidence semantics, real-site breadth results and blocked-site failure record.
- [`stage8-ai-evaluation.md`](stage8-ai-evaluation.md) - advisory AI authority boundary and evaluation record.
- [`stage9-learning-loop.md`](stage9-learning-loop.md) - Verified Learning as the residual advisory layer: human-confirmed outcomes, review-priority learning, frozen promotion gate and explicit separation from deterministic enforcement.
- [`vendor-intelligence-v1.md`](vendor-intelligence-v1.md) - versioned first-party vendor documentation registry, Expected / Approved / Capable / Observed / Context model, provenance rules and frozen-authority boundary.

## Judge-facing submission package

- [`real-world-validation.md`](real-world-validation.md) - the controlled-vs-public validation argument and exact 40-site claims.
- [`submission-technical-writeup.md`](submission-technical-writeup.md) - concise technical narrative intended to fit within the four-page submission limit.
- [`submission-demo-script.md`](submission-demo-script.md) - approximately two-minute click-by-click judge demo.

## Document discipline

Architecture versions are immutable once superseded. Do not silently rewrite an older architecture version to reflect a new concept.

When an architectural invariant changes because implementation or evaluation produces contradictory evidence:

1. create a new versioned architecture document;
2. explain the reason for the change;
3. record the evidence or failing test that forced it;
4. update the README and demo contract if public behavior changed.

Research-derived observations may inform design, but raw HAR captures, credentials and personal data must never be committed here.
