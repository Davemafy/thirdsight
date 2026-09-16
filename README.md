# ThirdSight

ThirdSight is a third-party integration control plane for commerce systems. It makes data access visible, detects behavior that drifts from an integration's declared baseline, and applies proportional responses instead of relying on a binary allow/block model.

Built for NITDA / ICSC 2026 Track G: **Watching What Third Party Integrations Really Do**.

## Current prototype

- Five simulated commerce integrations
- Live field-access visibility
- Detection scenarios for scope drift, record-volume spikes, and behavior changes
- Context-aware handling of legitimate sales spikes
- Graded responses: Allow → Observe → Limit → Quarantine
- Simulated data only

## Development

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## Structure

```text
src/
├── App.tsx      # interface and presentation
├── main.tsx     # application entrypoint
├── model.ts     # domain types, baselines, scenarios, event generator
└── styles.css   # application styles
```
