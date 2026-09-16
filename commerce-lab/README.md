# ThirdSight Commerce Lab

A deliberately small, synthetic commerce application used to generate real third-party integration traffic for ThirdSight.

## Why this exists

ThirdSight should be tested against genuine integration boundaries, not only fabricated log rows. The lab uses real sandbox/test APIs while keeping all shoppers, orders, products and events synthetic.

The first integration is Paystack test mode. The checkout API calculates price from the server-owned catalog, initializes a Paystack transaction, and emits metadata-only access evidence to ThirdSight. The webhook verifies Paystack's HMAC signature before accepting payment events.

## Data boundary

The checkout form collects only an email address, product ID and quantity. The browser never supplies authoritative price. ThirdSight telemetry records field names and integration metadata, not raw customer values.

## Run

```bash
cp .env.example .env.local
npm install
npm run dev -- -p 3001
```

Use a Paystack **test** secret key. Do not use real customer information.

## Current scope

Stage 0 intentionally has no database. It proves the outbound Paystack boundary, inbound signed webhook boundary and ThirdSight evidence contract. Supabase persistence, delivery and a controlled adversarial integration come next.
