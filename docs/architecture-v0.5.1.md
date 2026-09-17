# ThirdSight Architecture 0.5.1

**Status:** IMPLEMENTATION-FROZEN  
**Role:** Canonical implementation baseline  
**Change policy:** Architectural invariants may change only when implementation or evaluation produces concrete contradictory evidence. Any such change requires a written reason, regression evidence, and a version bump.

## Thesis

> **ThirdSight continuously verifies whether third-party access remains consistent with an explicit, reviewable business-purpose contract and the real business activity behind it, then applies the smallest justified response when that access cannot be explained.**

ThirdSight is not an intent detector. It does not claim to determine whether a vendor, employee, script, or attacker is malicious. It verifies consistency between approved purpose, technical access, observed behavior, and trusted first-party business context.

## Architectural invariants

The following are locked for the 0.5.1 implementation baseline:

1. ThirdSight verifies access consistency; it does not claim to infer malicious intent.
2. SHOULD, COULD, DID, and WHY are independently sourced evidence dimensions.
3. Every security claim carries provenance and confidence. Unknown remains unknown.
4. Prevention and detection are different capabilities. Managed inline boundaries can prevent. Passive sensors can discover and contain future activity.
5. WHY comes from trusted first-party business state, preferably correlated to the specific business object involved.
6. Hard Purpose Contracts never auto-expand from observed behavior, learned baselines, or LLM output.
7. Responses remain graded: ALLOW -> OBSERVE -> CONSTRAIN -> ISOLATE.
8. CONSTRAIN means the smallest enforceable reduction in unjustified access, not automatic shutdown.
9. Deterministic evidence owns provable violations. AI is limited to ambiguous reasoning, explanation, and recommendations.
10. Blind spots are first-class product state. No sensor means no visibility; opaque payloads may remain unknown; perfectly purpose-consistent compromise may be undetectable.
11. The prototype and evaluation use synthetic or properly anonymised data only. Raw research HARs are never part of shipped datasets.
12. Historical decisions, contracts, and policy interpretations are versioned and attributable.

Schemas, finding taxonomy, thresholds, correlation windows, adapters, UI structure, and implementation mechanisms are versioned engineering details rather than architectural invariants.

---

## The evidence model

Every ThirdSight decision is built from four independent questions.

### SHOULD — approved purpose

**Question:** What is this integration approved to access for its declared business purpose?

Source of truth: an explicit, reviewable Purpose Contract.

A Purpose Contract must identify the integration, purpose, resources, fields or data categories, operations, valid business triggers, environment, owner, approval history, review date, version, and change reason.

SHOULD is policy evidence. It is authoritative as the currently approved policy, but ThirdSight does not pretend that a poorly written or overly broad contract is automatically good governance. Over-broad declarations may be surfaced for review.

### COULD — technical access surface

**Question:** What can this integration technically reach?

COULD must never be inferred solely from SHOULD or from one observed request.

Its evidence may include:

- authoritative API scopes or grants;
- database roles and privileges;
- credential metadata;
- configured SDK capability;
- successful observed access as a lower bound;
- an explicit UNKNOWN/PARTIAL state when the full surface cannot be proven.

For example, a database role may provide an exact permission surface, while arbitrary browser JavaScript may expose only a partial or configured capability view.

### DID — observed access

**Question:** What did the integration actually attempt, access, or transmit?

DID comes only from runtime observation at a known boundary. A DID claim records the sensor, integration or credential identity, operation, resource, semantic data categories, transport field names, business-object references where available, timing, outcome, and relevant policy versions.

An attempted request and a successfully transmitted request are distinct outcomes.

### WHY — trusted business justification

**Question:** What first-party business event explains this access?

WHY comes from trusted first-party application state, not from a third party asserting its own justification.

Preferred correlation strength:

1. exact correlation/reference ID;
2. same hashed business-object identifier;
3. valid trigger plus bounded time window;
4. temporal coincidence only.

The system should prefer object-level correlation. A delivery integration reading the customer assigned to delivery `D-123` is different from reading an unrelated customer during the same busy period.

---

## Evidence confidence

Security claims must expose both provenance and confidence.

Baseline confidence labels:

- **AUTHORITATIVE** — direct first-party policy/state or authoritative permission source;
- **OBSERVED** — directly witnessed by a runtime sensor;
- **DECLARED** — configuration or vendor/developer declaration, not independently proven;
- **OBSERVED_LOWER_BOUND** — proves at least this much technical reach but not the complete surface;
- **INFERRED** — derived from correlation or classification and must show its basis;
- **UNKNOWN** — evidence is insufficient to make the claim.

The UI must never convert UNKNOWN into a safe/green state.

---

## Semantic data lineage

Policy applies to information, not merely transport field names.

ThirdSight therefore treats representations such as:

```text
customer.email
  -> normalized
  -> SHA-256
  -> vendor transport field: auto_email
```

as the same underlying semantic data category when the lineage is known.

A renamed, encoded, or hashed value does not automatically escape its Purpose Contract. Where lineage cannot be established reliably, the result is marked uncertain rather than silently classified as safe.

---

## Trust boundaries and discovery plane

The API gateway is one sensor, not the visibility boundary of ThirdSight.

```text
Commerce application
  |-- Managed browser adapter / pre-send policy
  |-- Browser observer
  |-- Server egress sensor
  |-- API gateway sensor
  |-- Webhook sensor
  |-- DB audit sensor
  |-- Credential and permission inventory
  `-- Business-event emitter
             |
             v
      Evidence normalizer
             |
             v
        Evidence graph
      SHOULD COULD DID WHY
             |
             v
   Deterministic verification
             |
      ambiguous cases only
             v
          AI analyst
             |
             v
ALLOW / OBSERVE / CONSTRAIN / ISOLATE
             |
             v
   Append-only incident history
```

### Managed boundaries

A managed boundary sits inline before data leaves or before a third party reaches protected data. Examples include the API gateway, a server egress adapter, or a controlled browser analytics adapter.

Managed boundaries can produce **PREVENTED** outcomes because policy is checked before transmission or access.

### Passive discovery boundaries

Passive sensors observe activity that may already have happened, including browser network observation or database audit trails.

Passive sensors can produce **DETECTED** outcomes and can trigger containment of subsequent activity. They must not be described as having prevented the first observed event when they did not.

This distinction is mandatory in the evidence model and product UI.

---

## Authority model

ThirdSight uses a deterministic access-verification core with an AI reasoning layer for ambiguity.

### Deterministic authority

Deterministic rules own provable statements such as:

- field or semantic category outside the approved contract;
- credential expired or revoked;
- integration operating in the wrong environment;
- exact object access without an allowed relationship;
- known permission outside approved purpose;
- explicit record or rate limits exceeded.

A hard deterministic violation may be enforced automatically at a managed boundary when the configured policy authorises that action.

### AI authority

The AI analyst receives structured metadata and evidence references, not raw customer payloads.

It may:

- analyse ambiguous sequences;
- explain why evidence is suspicious or inconclusive;
- group related observations into an incident;
- recommend OBSERVE;
- recommend a CONSTRAIN candidate for review.

It may not:

- widen a Purpose Contract;
- grant permissions;
- turn UNKNOWN into safe;
- independently ISOLATE an integration in the 0.5.1 prototype;
- override a deterministic hard violation.

If AI provides no measurable improvement over deterministic rules plus business context, it is not treated as a product advantage.

---

## Response semantics

ThirdSight uses four response levels.

### ALLOW

The observed activity is consistent with current purpose, permission evidence, and business context.

### OBSERVE

Evidence is ambiguous, incomplete, novel, or low-confidence. The activity continues while ThirdSight gathers more evidence or requests review.

OBSERVE is the default for uncertainty when a hard policy violation has not been proven.

### CONSTRAIN

Remove the smallest unjustified capability while preserving legitimate operation wherever possible.

Examples include:

- remove `customer.phone` from a managed analytics event before send;
- deny one API field or resource;
- cap records to assigned business objects;
- narrow a database grant;
- rate-limit enumeration;
- block one destination while leaving the integration otherwise operational.

If field-level removal would make a partner request invalid, ThirdSight denies that request explicitly rather than silently manufacturing a malformed response.

### ISOLATE

Suspend or revoke the integration/credential when narrower controls are insufficient, when a hard policy requires isolation, or after explicit human confirmation for an ambiguous case.

Isolation is reversible. Restoration requires an explicit recovery action and does not erase incident history.

---

## Finding taxonomy

Finding names are versioned engineering details, not architecture invariants. The 0.5.1 baseline currently uses:

- `EXCESS_PERMISSION` — COULD exceeds SHOULD;
- `SCOPE_DRIFT` — DID falls outside SHOULD;
- `PURPOSE_MISMATCH` — DID lacks credible WHY;
- `VOLUME_DRIFT` — activity is abnormal after business-context normalization;
- `STALE_INTEGRATION` — retired, expired, or abandoned integration remains active;
- `SHADOW_INTEGRATION` — observed access has no valid registered integration path;
- `ENVIRONMENT_MISMATCH` — access/credential appears in the wrong environment.

These may merge, split, or be renamed only as versioned engineering changes backed by implementation/evaluation evidence.

---

## Business normalization

Raw traffic volume is insufficient.

The detector must distinguish:

```text
10x orders -> ~10x payment calls
```

from:

```text
10x orders -> unrelated customer enumeration
```

Where possible, behavior is normalized by trusted business units such as active deliveries, checkout sessions, product views, or campaign activity.

Object-level correlation is stronger than aggregate ratios. A proportional attacker who scales extraction with a flash sale should still be detected when the accessed objects are not justified by the corresponding business events.

---

## Versioning and history

Purpose Contracts are immutable once published. A change creates a new version with actor, timestamp, change reason, added/removed permissions, and review metadata.

Access events and findings must reference the active contract/policy versions used for their decision.

Credential identity is separate from integration identity so credential rotation preserves integration history.

Incident history is append-only at the application level: resolution or restoration adds new events rather than deleting the original evidence.

---

## Offline behavior

When network connectivity is lost:

- cached Purpose Contracts remain available;
- cached deterministic hard rules continue at managed boundaries;
- events buffer locally where feasible;
- remote AI reasoning may pause;
- uncertainty defaults to OBSERVE rather than inventing certainty;
- known hard violations may still be constrained;
- buffered evidence is reconciled after connectivity returns.

The prototype must state clearly which controls require network access and which remain local.

---

## Declared limitations

ThirdSight 0.5.1 explicitly does **not** claim universal visibility or perfect compromise detection.

1. **No sensor, no visibility.** Systems without a supported observation or permission source may remain invisible.
2. **Opaque browser payloads.** Arbitrary proprietary SDK payloads may not be semantically decodable. Destination, initiator, timing, size, and other metadata may still be observable, but field-level meaning can remain UNKNOWN.
3. **Incomplete COULD.** Some SaaS/browser integrations expose no authoritative permission API. ThirdSight must label the known surface as partial/lower-bound rather than complete.
4. **Purpose-consistent compromise.** If a compromised partner performs the same permitted operation, against the same justified business object, at normal timing and volume, the evidence model may contain no contradiction. ThirdSight does not claim to detect that case.
5. **Downstream use after legitimate egress.** Once data legitimately leaves a controlled boundary, ThirdSight cannot prove how a vendor later processes or redistributes it without additional vendor-side evidence.
6. **Purpose quality.** ThirdSight can verify consistency with an approved contract and flag over-broad declarations for review, but it cannot mathematically prove that a business truly needs a field.
7. **Inference uncertainty.** Semantic lineage and correlation can be uncertain. Low-confidence inference must remain visible and cannot silently become deterministic policy.
8. **Business continuity risk.** Incorrect restriction can break payments, delivery, analytics, or signup flows. This is why the system uses graded response and minimal constraint rather than defaulting to shutdown.

---

## Research basis

Architecture 0.5.1 was shaped by controlled browser-traffic reconnaissance across five commerce systems representing different integration patterns:

- Jumia Nigeria — marketplace, commerce events, analytics/ad-tech;
- Konga — Nigerian marketplace and checkout/payment boundary;
- Heyfood — food delivery, location, analytics, and support patterns;
- Temu — telemetry-heavy commerce architecture;
- AliExpress — broad marketplace/ad-tech telemetry graph.

These captures are research inputs only. Raw HAR files, session material, credentials, customer data, and raw payload values are not committed to the repository or used as production/demo datasets.

---

## Change-control rule

An architectural invariant in this document may change only when all four conditions are met:

1. a failing implementation, impossible requirement, contradictory observation, or evaluation result demonstrates the problem;
2. the reason is written down;
3. a regression/evaluation case captures the evidence;
4. the architecture version is bumped.

A new idea, UI preference, library choice, or model preference alone is not sufficient reason to change an invariant.
