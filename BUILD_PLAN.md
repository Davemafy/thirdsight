# Track G — build order to submission

## Product thesis
Third-party integrations should not be trusted forever just because they were approved once. ThirdSight continuously compares what an integration is doing now against what it declared and what the commerce platform currently expects.

## Detection model
For every integration event calculate four signals:

- **scope drift** — fraction of touched data types that were never declared
- **volume deviation** — record count relative to the integration's dynamic baseline
- **sequence deviation** — whether the action sequence differs from legitimate historical flow
- **business context** — whether the traffic change is explained by a correlated platform event such as a sale, campaign, or batch fulfilment

Conceptual risk score:

`risk = 0.40*scope_drift + 0.30*volume_deviation + 0.20*sequence_deviation - 0.25*business_context`

Then map risk to a proportional response:

- 0.00–0.24 → Allow
- 0.25–0.44 → Observe
- 0.45–0.69 → Limit
- 0.70–1.00 → Quarantine

The demo deliberately shows that high volume alone is not enough to block an integration.

## Sprint

### P0 — already scaffolded
- live integration map
- live activity feed
- declared field scopes
- five demo scenarios
- graded response UI
- legitimate sales-spike non-false-positive case

### P1 — next
- extract deterministic policy engine to its own module
- persist event history in localStorage / mock API
- show per-signal risk contribution, not just final verdict
- add a one-click “Run judge demo” sequence

### P2 — submission polish
- deploy on Vercel
- 2–3 minute demo recording
- architecture diagram
- concise README with problem → solution → evidence
- failure/limitations section

## Judge demo narrative
“Payments, identity, delivery, messaging and analytics all need customer data, but permission at install time does not tell us what they are doing later. ThirdSight makes every touch visible. Here is normal traffic. Now sales spike 164%: ThirdSight sees the same declared fields and a matching business event, so it observes instead of blocking. Next, Analytics suddenly requests phone numbers: that is scope drift, so access is limited. Messaging then pulls 640 customer records without any correlated event: it is quarantined. The platform keeps operating while risky behavior is contained proportionally.”
