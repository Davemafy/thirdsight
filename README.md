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
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — repository structure, naming, data handling, and quality conventions.

Architectural invariants change only when implementation or evaluation produces contradictory evidence. Any such change requires a written reason, regression evidence, and a version bump.

## Current implementation

The current application is an early prototype shell being replaced incrementally by the 0.5.1 architecture.

The first required end-to-end slice is intentionally narrow: a managed analytics event containing approved product fields plus an unapproved `customer.phone` field must be checked against its Purpose Contract, have the phone removed **before transmission**, allow the legitimate remainder to continue, and record the complete evidence chain.

## Repository layout

```text
.
├── docs/                       # Canonical architecture and demo specifications
├── src/
│   ├── app/                    # React application composition
│   │   ├── App.tsx
│   │   └── model.ts            # Temporary prototype model; replaced as domain modules land
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

Future directories such as `src/domain/`, `src/infrastructure/`, and `src/demo/` are added only when real implementation code exists. The repository does not keep placeholder folders.

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
