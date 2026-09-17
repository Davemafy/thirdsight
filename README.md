# ThirdSight

ThirdSight is a third-party access verification layer for commerce systems.

> **ThirdSight continuously verifies whether third-party access remains consistent with an explicit, reviewable business-purpose contract and the real business activity behind it, then applies the smallest justified response when that access cannot be explained.**

Built for NITDA / ICSC 2026 Track G: **Watching What Third Party Integrations Really Do**.

## Frozen implementation baseline

ThirdSight Architecture **0.5.1** is the current implementation baseline.

Its locked architectural semantics are:

- **SHOULD** — what an integration is approved to access for its declared business purpose
- **COULD** — what its technical permissions/capabilities allow
- **DID** — what runtime sensors actually observe
- **WHY** — the trusted first-party business event that justifies the access
- Evidence must carry provenance and confidence; unknown remains unknown
- Managed inline boundaries may prevent access; passive sensors discover and contain
- Responses are **ALLOW → OBSERVE → CONSTRAIN → ISOLATE**
- Deterministic evidence owns provable violations; AI is limited to ambiguity reasoning and explanation
- Purpose Contracts never auto-expand from observed behavior or LLM output
- Known blind spots are part of the product rather than hidden behind a risk score

Read the canonical documents before changing core behavior:

- [`docs/architecture-v0.5.1.md`](docs/architecture-v0.5.1.md) — architecture invariants, evidence semantics, trust boundaries, authority, response semantics, and declared limitations
- [`docs/demo-contract-v1.md`](docs/demo-contract-v1.md) — required end-to-end demo behavior and acceptance gates

Architectural invariants may change only when implementation or evaluation produces concrete contradictory evidence. Any such change requires a written reason, regression evidence, and a version bump.

## Current implementation

The repository currently contains the initial prototype UI/model and an in-progress commerce harness branch. The architecture documents above are the source of truth for the next implementation phase.

The first required vertical slice is deliberately narrow: an analytics event containing approved product fields plus an unapproved `customer.phone` field must be checked against the Purpose Contract, have the phone removed **before transmission**, allow the legitimate remainder to continue, and record the complete `SHOULD / COULD / DID / WHY / CONSTRAIN / PREVENTED` evidence chain.

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

> Build verification is environment-dependent and should be run locally/CI before treating a commit as release-ready.
