# ThirdSight

**Continuous third-party access verification for commerce systems.**

ThirdSight verifies whether third-party access remains consistent with an explicit, reviewable business-purpose contract and the real business activity behind it, then applies the smallest justified response when that access cannot be explained.

Built for NITDA / ICSC 2026 Track G: **Watching What Third Party Integrations Really Do**.

## Implementation baseline

Architecture **0.5.1** is implementation-frozen. Core behavior is defined by four independently sourced evidence dimensions:

- **SHOULD** — what an integration is approved to access for its declared business purpose.
- **COULD** — what its technical permissions or capabilities allow.
- **DID** — what runtime sensors actually observe.
- **WHY** — the trusted first-party business event that justifies the access.

Responses are graded: **ALLOW → OBSERVE → CONSTRAIN → ISOLATE**.

ThirdSight distinguishes prevention from detection. Managed inline boundaries may prevent unjustified access before transmission; passive sensors can discover behavior and contain subsequent activity. Unknown evidence remains explicitly unknown.

## Canonical documents

- [`docs/architecture-v0.5.1.md`](docs/architecture-v0.5.1.md) — architecture invariants, evidence semantics, trust boundaries, authority model, response semantics, and limitations.
- [`docs/demo-contract-v1.md`](docs/demo-contract-v1.md) — required demo behavior, adversarial scenarios, and acceptance gates.
- [`docs/README.md`](docs/README.md) — documentation versioning rules.
- [`docs/stage8-ai-evaluation.md`](docs/stage8-ai-evaluation.md) — frozen advisory-AI evaluation and promotion record.
- [`docs/stage9-learning-loop.md`](docs/stage9-learning-loop.md) — verified feedback, candidate training, and frozen learning gate.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — repository structure, naming, data handling, and quality conventions.

Architectural invariants change only when implementation or evaluation produces contradictory evidence. Any such change requires a written reason, regression evidence, and a version bump.

## Current implementation

ThirdSight now has an evidence-backed end-to-end prototype rather than a mock dashboard. It persists browser and managed-runtime evidence, reconstructs SHOULD / COULD / DID / WHY, distinguishes post-access detection from inline prevention, evaluates deterministic adversarial scenarios, and exposes only persisted results in the evidence console.

Stage 7 freezes the deterministic detector. Stage 8 adds a separately gated advisory AI analyst with no enforcement authority. Stage 9 adds a verified learning loop: a human-confirmed ambiguous outcome becomes a PII-minimized training example, a small classifier trains off the live decision path, and the candidate is promoted only after passing a frozen held-out benchmark. Learned recommendations remain limited to **REVIEW / OBSERVE / ABSTAIN**.

## Repository layout

```text
.
├── docs/                       # Canonical architecture and demo specifications
├── src/
│   ├── app/                    # Evidence console and advisory learning UI
│   ├── domain/                 # Frozen evidence and deterministic verification semantics
│   ├── infrastructure/         # Browser, DB-audit, persistence, and auth adapters
│   ├── ai-analyst/             # Stage 8 advisory AI boundary and evaluation
│   ├── learning-loop/          # Stage 9 verified feedback, training, and promotion gate
│   ├── styles/
│   │   └── global.css
│   └── main.tsx                # Browser entrypoint
├── .editorconfig
├── .gitignore
├── CONTRIBUTING.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

Directories are added only when real implementation code exists. The repository does not keep placeholder folders.

## Development

Requirements: Node.js **20.19+** and npm.

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run typecheck
npm run build
```

## Data handling

The prototype and evaluation use synthetic or properly anonymised data only. Raw HAR captures, real customer data, cookies, tokens, credentials, and research archives must never be committed to this repository.
