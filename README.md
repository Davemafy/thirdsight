# ThirdSight — NITDA / ICSC 2026 Track G

Prototype for **Commerce & Consumer Protection — “Watching What Third Party Integrations Really Do.”**

## What the demo proves
- Simulated commerce platform with five third-party integrations.
- Live map of the fields each integration touches.
- Real-time detection for:
  - undeclared/new data types,
  - excessive record access,
  - changed access behavior.
- Graded response: **Allow → Observe → Limit → Quarantine**.
- A legitimate sales spike increases volume without causing a false positive because context, scope, and correlated business activity remain valid.
- Uses only simulated data.

## Run
```bash
npm install
npm run dev
```

## Judge demo sequence
1. Start on **Normal traffic** — zero active risk signals.
2. Switch to **Legitimate sales spike** — volume jumps, system chooses Observe instead of blocking.
3. Switch to **New data type** — Analytics reaches for `phone`, system chooses Limit.
4. Switch to **Excessive records** — Messaging pulls 640 records, system quarantines.
5. Switch to **Behavior change** — Delivery enumerates profiles outside normal order-driven flow.

## Next build layer
Persist event history + policies, add a tiny mock gateway/API, explain baseline scoring, and prepare a 2–3 minute demo script.

## Repository

https://github.com/Davemafy/thirdsight
