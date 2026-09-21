# Managed integration compatibility — Nigerian ecommerce stack

ThirdSight exercises one generic managed gateway across ten integrations representative of a Nigerian ecommerce stack. The compatibility suite uses the existing deterministic verification authority; vendor names do not determine policy outcomes.

## Claim boundary

- **LIVE_SANDBOX: 0.** No live vendor sandbox success is claimed in this artifact.
- **CONTROLLED_RECEIVER: 9.** The real ThirdSight gateway, request normalization, Purpose Contract projection, deterministic verifier, field constraint, lifecycle isolation and forwarder are exercised against an instrumented receiver in automated tests.
- **SCHEMA_COMPATIBLE: 1.** Kwik uses a representative request fixture and the same gateway path, but is not described as live or receiver-verified against Kwik itself.
- **60 automated cases:** 10 integrations × 6 scenarios.

Inventory coverage or vendor documentation never becomes merchant approval. The merchant Purpose Contract remains the authority for SHOULD.

## Compatibility set

| Integration | Commerce role | Classification |
| --- | --- | --- |
| Paystack | payment | `CONTROLLED_RECEIVER` |
| Flutterwave | payment | `CONTROLLED_RECEIVER` |
| Monnify | payment / virtual accounts | `CONTROLLED_RECEIVER` |
| Interswitch Webpay | payment | `CONTROLLED_RECEIVER` |
| Sendbox | shipping / logistics | `CONTROLLED_RECEIVER` |
| Kwik Delivery | last-mile fulfilment | `SCHEMA_COMPATIBLE` |
| Termii | SMS / customer notification | `CONTROLLED_RECEIVER` |
| Sendchamp | messaging | `CONTROLLED_RECEIVER` |
| Meta Conversions API | ads / conversion attribution | `CONTROLLED_RECEIVER` |
| Google Analytics 4 | analytics | `CONTROLLED_RECEIVER` |

## Six cases per integration

| Scenario | Expected gateway behavior | Proof intent |
| --- | --- | --- |
| `LEGITIMATE` | `ALLOW` | Approved payload and valid first-party context. |
| `EXTRA_FIELD` | `CONSTRAIN` | One unapproved field is removed before the controlled receiver sees the body. |
| `WRONG_BUSINESS_CONTEXT` | `CONSTRAIN` | A mismatched business-object reference is not accepted as justification; the upstream is not contacted. |
| `RETIRED_INTEGRATION` | `ISOLATE` | Retired integration lifecycle state prevents the outbound call. |
| `BUSY_LEGITIMATE` | `ALLOW` | Ten legitimate requests remain allowed with no policy finding. |
| `FAILURE` | `CONFIGURED` | CLOSED integrations stop; ALLOW_AND_AUDIT integrations forward in degraded OBSERVE mode. |

The extra-field case adds `customer.private_note` to an otherwise legitimate request. The field must be absent from the body received by the controlled receiver while approved siblings continue.

The wrong-context case supplies a request-level order reference that differs from the trusted first-party BusinessEvent. ThirdSight uses the frozen deterministic verifier's `PURPOSE_MISMATCH` behavior and does not widen purpose from nearby sales traffic.

The busy case sends ten legitimate requests for each integration and expects no false policy finding. The failure case uses the integration's explicit `CLOSED` or `ALLOW_AND_AUDIT` configuration rather than choosing behavior dynamically.

## Purpose differentiation proof

The Commerce Lab adds a separate end-to-end comparison:

- `cedar-analytics`: `customer.phone` is outside the analytics Purpose Contract, so an attempted analytics request is constrained before forwarding.
- `cedar-delivery`: `customer.phone` is explicitly approved for fulfilment, so the delivery request is allowed.

The decision comes from merchant-approved Purpose Contracts and trusted context, not from hardcoded vendor-name logic.
