# ThirdSight

**Purpose-aware control plane for third-party integrations.**

ThirdSight can sit inline on a registered outbound integration. It compares what a merchant approved against what the application is actually trying to send, uses trusted first-party business context, removes or stops unjustified access before data leaves when deterministic evidence supports that action, forwards the legitimate remainder to the real registered upstream, and preserves append-only evidence of the decision.

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

## How another platform uses ThirdSight

A customer connects ThirdSight at the boundary where third-party access can actually be observed:

- **Managed gateway** — strongest mode; a merchant routes a registered HTTP integration through `/api/managed-gateway` or the thin `ThirdSight` client. Upstream origin, route and credentials remain server-owned; the existing deterministic verifier can ALLOW, OBSERVE, CONSTRAIN or ISOLATE before forwarding.
- **Browser sensor** — passive discovery of privacy-reduced cross-origin request metadata through the existing `/api/browser-observations` ingestion path.
- **Audit / backend evidence** — post-access visibility for systems that cannot be placed behind an inline boundary.

Connection mode determines what ThirdSight can prove. Browser-only evidence never silently becomes merchant intent, full backend capability or prevention.

See [Product onboarding](docs/product-onboarding.md) for the concrete adoption flow, SDK example and gateway security boundary. The [Nigerian ecommerce compatibility suite](docs/managed-integration-compatibility.md) exercises the same generic path across 10 integration profiles and 60 automated scenarios without claiming unperformed live-sandbox tests.

## Real-world validation

ThirdSight keeps controlled proof, public discovery, and documentation enrichment separate:

- **Commerce Lab** - ground truth for deterministic correctness, graded response, managed prevention, proportional-abuse detection and the no-false-alarm flash-sale proof.
- **40-site Nigeria-facing benchmark** - passive, logged-out discovery breadth under browser-only visibility limits: **40 attempted, 30 loaded normally, 203 representative observations, 118 unique origins**.
- **1,000-site scale benchmark** - a reproducible high-traffic public-web sample: **1,000 attempted, 522 loaded normally, 32,083 cross-origin requests observed, 980 representative observations persisted, 3,354 unique origins indexed**.
- **Vendor Intelligence v2** - first-party vendor documentation adds an `Expected` and documented-capability layer where an origin can be resolved, while merchant policy remains the only source of `Approved`.

Every one of the **3,354** scale-run origins is represented in a generated inventory. Inventory coverage is not the same as vendor identification: unresolved origins stay unresolved rather than receiving a guessed product identity. Browser-only evidence still does not infer merchant authorization, backend permissions, maliciousness, necessity or downstream behavior.

Submission materials:

- [Real-world validation](docs/real-world-validation.md)
- [Technical submission write-up](docs/submission-technical-writeup.md)
- [~2 minute judge demo](docs/submission-demo-script.md)

## Repository layout

```text
.
├── docs/                       # Canonical architecture and demo specifications
├── src/
│   ├── app/                    # Evidence console and advisory learning UI
│   ├── domain/                 # Frozen evidence and deterministic verification semantics
│   ├── infrastructure/         # Browser, DB-audit, persistence, gateway evidence, and auth adapters
│   ├── gateway/                # Registered-upstream routing, credential custody, failure semantics
│   ├── managed/                # Generic request normalization and shared enforcement adapter
│   ├── sdk/                    # Thin managed-gateway client
│   ├── compatibility/          # Nigerian ecommerce integration fixtures and 60-case suite
│   ├── ai-analyst/             # Stage 8 advisory AI boundary and evaluation
│   ├── learning-loop/          # Stage 9 verified feedback, training, and promotion gate
│   ├── styles/
│   │   └── global.css
│   └── main.tsx                # Browser entrypoint
├── services/
│   ├── cedar-commerce/         # Independent Next.js store and commerce API
│   └── partner-lab/            # Independent signed partner receivers and receipt UI
├── src/infrastructure/gateway/ # Managed ThirdSight integration boundary
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

The standalone commerce ecosystem has separate install, migration and runtime
boundaries. See [ThirdSight Commerce Lab](docs/commerce-ecosystem.md) for its
topology, environment contract, routes, test commands and canonical demo path.

## Data handling

The prototype and evaluation use synthetic or properly anonymised data only. Raw HAR captures, real customer data, cookies, tokens, credentials, and research archives must never be committed to this repository.

## Recording-ready merchant self-service

The Connections screen now supports a constrained merchant-scoped provisioning preview: create a workspace, approve one fixed CEDAR preset, receive a one-time merchant API key, and send a real request through the existing managed gateway. See [Recording-ready merchant self-service](docs/self-service-control-plane.md).

The Node client is currently distributed as a repository-hosted preview tarball rather than an npm-registry release:

```bash
npm install https://raw.githubusercontent.com/Davemafy/thirdsight/main/packages/thirdsight-node/thirdsight-node-0.1.0.tgz
```
