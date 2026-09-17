# ThirdSight Demo Contract v1

**Architecture baseline:** 0.5.1  
**Status:** FROZEN FOR IMPLEMENTATION  
**Purpose:** Define the minimum end-to-end behavior the prototype must demonstrate before additional polish or feature expansion.

## Demo objective

The demo must prove that ThirdSight can connect approved purpose, technical reach, observed access, and first-party business context into one explainable decision path:

```text
SHOULD -> COULD -> DID -> WHY -> FINDING -> RESPONSE -> EVIDENCE
```

The demo is not complete if this chain exists only in UI fixtures. It must be backed by real prototype state and real enforcement or observation at the demonstrated boundary.

## Canonical merchant environment

The prototype uses a synthetic commerce application with synthetic users, products, orders, payment attempts, deliveries, and campaigns.

No real customer data is permitted in the demo or evaluation dataset.

The merchant application is the trusted first-party source for business events and authoritative business-object relationships.

## Required integration roles

### 1. PaymentProvider

A managed server-side payment boundary using a real sandbox/test integration where practical.

Purpose: initialize and verify payments for an active checkout.

Expected demo behavior:

- valid payment request is ALLOWed;
- business context links the payment attempt to the active order/checkout;
- metadata-only access evidence is recorded;
- the demo never implies knowledge of the provider's complete internal data access.

### 2. AnalyticsPartner

A managed browser or server analytics boundary controlled by the prototype.

Purpose: product analytics.

Initial approved semantic data categories:

- `product.id`
- `product.category`
- `product.price`

Explicitly not approved in v1:

- `customer.phone`
- `customer.email`
- `customer.address`

This integration provides the canonical pre-send CONSTRAIN demonstration.

### 3. DeliveryPartner

A controlled delivery integration.

Purpose: fulfil assigned deliveries.

Its access should be tied to specific active delivery objects so ThirdSight can demonstrate object-level WHY correlation rather than only aggregate traffic ratios.

### 4. LegacyCRM

A controlled retired/stale integration with a credential or database path that can bypass the normal API gateway.

Purpose: none after retirement.

This integration provides the canonical stale/shadow discovery demonstration.

### 5. ShadowPixel

A controlled unmanaged browser-side integration used to demonstrate passive discovery and the difference between DETECTED and PREVENTED.

Its payload may include an intentionally opaque mode so the UI can demonstrate UNKNOWN rather than falsely classifying the payload as safe.

## Required demo scenarios

### Scenario A — Normal commerce

A customer browses products and begins checkout.

Expected result:

- legitimate analytics events are ALLOWed;
- legitimate payment activity is ALLOWed;
- SHOULD/COULD/DID/WHY evidence is visible;
- no unnecessary incident is raised.

### Scenario B — Flash sale

Legitimate commerce traffic increases substantially.

Expected result:

- request volume rises with real business activity;
- business-normalized behavior remains acceptable;
- no false high-severity incident is created solely because raw traffic volume is high.

This scenario is mandatory.

### Scenario C — Proportional attack during flash sale

While legitimate sales volume is high, a controlled partner accesses unrelated customer objects at a proportional rate chosen to keep simple requests-per-order ratios near normal.

Expected result:

- naive raw-volume logic would not be sufficient;
- object-level WHY mismatch identifies unjustified accesses;
- a `PURPOSE_MISMATCH` or equivalent versioned finding is produced.

### Scenario D — Unauthorized field before send

AnalyticsPartner prepares an otherwise legitimate product analytics event containing `customer.phone`.

Expected result:

```text
product.id       ALLOW
product.category ALLOW
product.price    ALLOW
customer.phone   CONSTRAIN
```

`customer.phone` must be removed or denied **before transmission** at the managed boundary.

The remaining legitimate analytics event should continue successfully where technically valid.

The incident must be labelled **PREVENTED**, not merely DETECTED.

### Scenario E — Opaque unmanaged browser integration

ShadowPixel emits traffic whose field-level payload cannot be reliably decoded.

Expected result:

- destination/initiator/timing/size metadata may be recorded;
- semantic contents remain UNKNOWN/PARTIAL where unsupported;
- the UI must not label the payload safe solely because it could not decode it;
- subsequent containment may occur if policy permits, but the first passive observation must not be misrepresented as prevented.

### Scenario F — Stale integration bypasses gateway

LegacyCRM is retired, but its credential remains active and it reads customer records through a database path not visible to the API gateway.

Expected result:

- API gateway may see nothing;
- DB audit/credential evidence reveals access;
- the system produces `STALE_INTEGRATION`, `SHADOW_INTEGRATION`, or their future versioned equivalents;
- the credential can be ISOLATEd;
- incident history remains after restoration/recovery.

### Scenario G — Perfectly purpose-consistent compromise

A controlled actor uses a valid partner credential to perform exactly the operation the real partner is allowed to perform, against the correct business object, at normal timing and volume.

Expected result:

- ThirdSight may not detect the compromise;
- the demo explicitly states why the evidence contains no contradiction;
- the system does not fabricate a threat score to claim success.

This scenario is mandatory because it proves the stated limitation is real.

## Evidence requirements

Every demonstrated finding must expose:

- integration identity;
- credential or execution identity where available;
- sensor source;
- Purpose Contract version;
- permission evidence/snapshot where available;
- observed operation/resource/data category;
- matched or missing business event;
- finding rule or AI assessment provenance;
- response taken;
- whether the outcome was PREVENTED or DETECTED;
- confidence/coverage state.

## Response contract

Only these four architectural response levels are used:

- `ALLOW`
- `OBSERVE`
- `CONSTRAIN`
- `ISOLATE`

UI synonyms such as "limit", "quarantine", "risk score", or other labels must not replace the canonical semantics without an explicit versioned product-copy mapping.

## AI contract

The first implementation must work without requiring AI to prove hard violations.

AI may be added after the deterministic evidence path works end-to-end.

When present, the AI analyst may:

- assess ambiguous sequences;
- explain evidence;
- recommend OBSERVE;
- recommend a CONSTRAIN candidate.

It may not:

- expand Purpose Contracts;
- grant access;
- independently ISOLATE;
- override a deterministic hard violation;
- turn UNKNOWN into safe.

## Evaluation gate

The implementation is not considered demo-ready until it can be evaluated on reproducible synthetic scenarios.

At minimum record:

- precision;
- recall;
- false-positive rate;
- false negatives;
- legitimate operations disrupted;
- unnecessary access prevented;
- time to detection/prevention.

Development/tuning scenarios and final evaluation scenarios must be separated. Detector changes after the final evaluation set is revealed require a new evaluation version.

## Definition of done for the first vertical slice

Before building the full dashboard or adding more integrations, the prototype must successfully demonstrate:

```text
PRODUCT_VIEW
    |
    v
AnalyticsPartner event prepared
    |
    v
ThirdSight checks Purpose Contract
    |
    +-- product.id       allowed
    +-- product.category allowed
    +-- product.price    allowed
    `-- customer.phone   denied
    |
    v
customer.phone removed before send
    |
    v
remaining analytics event succeeds
    |
    v
incident records:
SHOULD / COULD / DID / WHY / CONSTRAIN / PREVENTED
```

If this path does not work from real prototype state, development does not move on to broader architecture, AI, or visual polish.

## Change control

This Demo Contract may change when implementation proves that a scenario is impossible, misleading, or technically invalid, or when evaluation produces contradictory evidence.

Any change requires:

1. written reason;
2. linked implementation/evaluation evidence;
3. regression case or replacement scenario;
4. demo contract version bump.
