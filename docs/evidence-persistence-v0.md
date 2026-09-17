# Evidence persistence and integration identity v0

**Status:** prototype implementation detail under Architecture 0.5.1.

This slice turns accepted browser observations into durable, queryable evidence while keeping identity resolution conservative.

## Runtime flow

```text
ThirdSight browser sensor
        |
        | browser-observation.v1 + installation token
        v
POST /api/browser-observations
        |
        | validate schema + size + auth
        v
browser evidence projection
        |
        | destination origin
        v
exact-origin integration registry lookup
        |
        +--> no active binding ------> UNRESOLVED
        |
        +--> one integration --------> RESOLVED
        |
        `--> conflicting integrations -> AMBIGUOUS
        |
        v
append browser_evidence_history
```

The evidence record remains append-only at the application level. Re-ingestion of the same record ID is idempotent and does not overwrite the existing row.

## Identity resolution rule

ThirdSight does not infer ownership from a hostname suffix, vendor-looking name, ad-tech category, or cross-origin status.

Resolution requires an active registry binding whose origin exactly matches the observed destination origin and whose environment and validity window match the observation. A binding is either:

- `AUTHORITATIVE` — merchant-owned registry evidence; or
- `DECLARED` — an explicit declaration that has not been independently proven.

If two active bindings assign the same origin to different integrations, the result is `AMBIGUOUS`. ThirdSight refuses to choose one.

This means a public-site observation such as traffic to an analytics origin can remain `UNRESOLVED` until a merchant or other authoritative source supplies identity evidence. That is intentional.

## Persistence

The prototype uses Supabase Postgres through the server-side PostgREST API. The browser extension never receives the Supabase service-role key.

Migration: `supabase/migrations/001_evidence_history.sql`

Required server environment variables:

```text
THIRDSIGHT_SUPABASE_URL
THIRDSIGHT_SUPABASE_SERVICE_ROLE_KEY
THIRDSIGHT_INGESTION_TOKEN
THIRDSIGHT_ENVIRONMENT
```

`GET /api/browser-observations?limit=50` returns recent durable history and requires the same prototype bearer token as ingestion.

## Sensor authentication

The prototype endpoint is no longer open for arbitrary posts. The browser sensor sends a configured bearer token and the API rejects unauthenticated requests.

This token prevents casual remote evidence poisoning, but it is not hardware-backed attestation. A sufficiently privileged local actor can inspect extension state or forge browser telemetry. ThirdSight therefore does not claim that the token proves the endpoint device itself is uncompromised.

## Stored data boundary

Durable browser history stores only the already reduced browser observation plus the derived evidence record and integration-resolution metadata. The browser sensor removes query strings and fragments and redacts obvious identifier-like path segments before local storage or delivery.

It does not persist observed request bodies, cookies, request headers, form values, or raw HAR material.

## Failure behavior

If durable persistence is not configured, the server returns `503 PERSISTENCE_NOT_CONFIGURED` rather than pretending the evidence was stored. If Supabase is unavailable, ingestion returns a persistence failure and the extension records the failed delivery in its local session state.

The extension still keeps its bounded in-session observation buffer. Durable retry/queue semantics are not implemented in this v0 slice and remain a known next step.
