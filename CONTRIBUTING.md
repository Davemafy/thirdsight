# Contributing to ThirdSight

ThirdSight is being built as a security-sensitive prototype. Keep changes small, explicit, and reviewable.

## Architecture rule

`docs/architecture-v0.5.1.md` is the implementation baseline. Architectural invariants may change only when implementation or evaluation produces concrete contradictory evidence. Any invariant change requires:

1. a written reason,
2. regression or evaluation evidence,
3. an architecture version bump.

Schemas, finding taxonomy, thresholds, adapters, UI structure, and implementation details may evolve without an architecture version bump when the invariants remain intact.

## Repository structure

Use these boundaries as the codebase grows:

- `src/app/` — React application composition and presentation.
- `src/domain/` — pure ThirdSight domain rules and types. No React or vendor SDK imports.
- `src/infrastructure/` — sensors, persistence, external integrations, and adapters.
- `src/demo/` — synthetic scenarios, traffic generators, and controlled adversarial integrations.
- `src/styles/` — shared/global styles.
- `docs/` — architecture, demo, evaluation, and research-derived design notes.

Do not create placeholder directories. Add a directory only when it contains real code or documentation.

## Naming

- React components: `PascalCase.tsx`.
- Non-component TypeScript modules: `kebab-case.ts`.
- Directories: lowercase `kebab-case`.
- Types and interfaces: `PascalCase`.
- Functions and variables: `camelCase`.
- Stable module-level constants: `UPPER_SNAKE_CASE` when they represent fixed configuration.
- Tests: colocate as `*.test.ts` or `*.test.tsx` unless a dedicated integration-test suite is required.

Avoid vague names such as `utils.ts`, `helpers.ts`, `stuff.ts`, `data.ts`, or `misc.ts` when a more precise domain name exists.

## Data and secrets

- Never commit raw HAR captures.
- Never commit real customer data, session cookies, API keys, bearer tokens, payment references, or vendor credentials.
- Demo and evaluation data must be synthetic or properly anonymised.
- Research captures are inputs to design decisions, not shipped product data.
- `.env.example` may document variable names, but must contain placeholders only.

## Quality gate

Before merging an implementation change:

```bash
npm run typecheck
npm run build
```

Also verify that:

- terminology matches the frozen response model: `ALLOW`, `OBSERVE`, `CONSTRAIN`, `ISOLATE`;
- unknown evidence remains explicitly unknown;
- passive observation is not described as prevention;
- no new architectural invariant has been introduced accidentally;
- documentation is updated when behavior or public claims change.

## Git hygiene

Use concise conventional commit messages where practical, for example:

- `feat: enforce analytics purpose contract`
- `fix: preserve evidence provenance on retries`
- `docs: clarify passive sensor limitation`
- `test: add proportional-attack scenario`
- `chore: standardize repository structure`

Prefer one coherent change per pull request. Do not commit generated build output, local editor state, temporary archives, or raw research artifacts.
