# ThirdSight Commerce Lab

This document covers the independently deployable CEDAR Commerce store,
ThirdSight managed gateway, and Partner Lab receiver. CEDAR is a fictional
Nigerian consumer-technology retailer. All people, addresses, phone numbers,
payments and orders used by the lab are synthetic.

## Runtime topology

```text
Shopper -> CEDAR storefront -> CEDAR API -> cedar_commerce schema
CEDAR order event -> ThirdSight /api/managed-gateway
ThirdSight -> registered integration + Purpose Contract + deterministic verifier
ThirdSight -> constrained legitimate request -> Partner Lab managed receiver
ThirdSight -> append-only evidence history

Legacy adversarial scenarios -> /api/gateway/v1/dispatch -> signed Partner Lab receiver
Partner Lab -> partner_lab.deliveries
```

ThirdSight is never in the shopper-to-catalogue, shopper-to-cart, or
shopper-to-order path. CEDAR commits an order before attempting optional
integration delivery, so a gateway or partner outage cannot reverse a valid
commerce transaction.

| Service | Project root | Responsibility | Database boundary |
| --- | --- | --- | --- |
| CEDAR Commerce | `services/cedar-commerce` | Storefront, catalogue, cart, checkout and orders | `cedar_commerce` schema |
| ThirdSight | repository root | Policy resolution, field enforcement and evidence | existing public evidence tables plus `gateway_dispatches` |
| Partner Lab | `services/partner-lab` | Signed analytics, advertising and CRM receivers | `partner_lab` schema |

## Local setup

Requirements are Node.js 20.19 or newer, npm, and PostgreSQL 15 or newer.

```bash
# ThirdSight
npm install
npm run dev

# CEDAR, from services/cedar-commerce
npm install
npm run db:migrate
npm run db:seed
npm run dev

# Partner Lab, from services/partner-lab
npm install
npm run db:migrate
npm run dev -- --port 3001
```

Copy each `.env.example` to `.env.local` for local development. Never expose a
database password, Supabase service-role key, integration secret or operator
secret through a `NEXT_PUBLIC_` variable.

## Environment variables

### CEDAR Commerce

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Server-only pooled PostgreSQL connection with access limited to `cedar_commerce` |
| `THIRDSIGHT_MANAGED_GATEWAY_URL` | Exact generic ThirdSight managed-gateway URL |
| `THIRDSIGHT_GATEWAY_API_KEY` | Merchant credential for the generic managed gateway |
| `THIRDSIGHT_GATEWAY_URL` | Legacy signed dispatch URL used by older adversarial scenarios |
| `THIRDSIGHT_MERCHANT_ID` | Fixed value `cedar-commerce` for the legacy adapter |
| `THIRDSIGHT_INTEGRATION_SECRET` | Legacy HMAC secret shared only with ThirdSight |
| `OPERATOR_ACCESS_SECRET` | Bearer secret for the fixed-enum operator route |
| `NEXT_PUBLIC_STORE_URL` | Public CEDAR origin; not a secret |

### ThirdSight

The existing `THIRDSIGHT_SUPABASE_URL` and
`THIRDSIGHT_SUPABASE_SERVICE_ROLE_KEY` remain server-only. The gateway adds:

| Variable | Purpose |
| --- | --- |
| `THIRDSIGHT_GATEWAY_API_KEY` | Authenticates managed merchant requests |
| `PARTNER_MANAGED_ORIGIN` | Server-owned origin for the Commerce Lab managed receiver |
| `PARTNER_MANAGED_TOKEN` | Credential injected by ThirdSight only after policy evaluation |
| `CEDAR_INTEGRATION_SECRET` | Verifies legacy CEDAR request signatures |
| `CEDAR_COMMERCE_URL` | Exact CORS origin for CEDAR |
| `PARTNER_ANALYTICS_URL` | Legacy registered analytics receiver URL |
| `PARTNER_ADVERTISING_URL` | Registered advertising receiver URL |
| `PARTNER_CRM_URL` | Registered CRM receiver URL |
| `PARTNER_GATEWAY_SECRET` | Signs ThirdSight-to-partner requests |

### Partner Lab

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Server-only pooled PostgreSQL connection with access limited to `partner_lab` |
| `THIRDSIGHT_PARTNER_SECRET` | Verifies legacy ThirdSight gateway signatures |
| `PARTNER_MANAGED_TOKEN` | Authenticates generic managed-gateway receiver calls |
| `ALLOWED_GATEWAY_ORIGIN` | Optional exact browser-origin allowlist for the legacy receiver |

Use independent random values for the CEDAR-to-ThirdSight and
ThirdSight-to-Partner secrets. Do not log or persist either secret.

## Database migrations and seed data

CEDAR migrations live in `services/cedar-commerce/migrations`; Partner Lab
migrations live in `services/partner-lab/migrations`; the additive ThirdSight
gateway migration is `supabase/migrations/008_cedar_gateway.sql`.

The CEDAR seed is reproducible and creates 10 products, 30 images, 39 variants,
39 inventory records, four collections, the synthetic `CEDAR10` promotion and
the default `unauthorized-field` scenario. Custom schemas revoke access from
the database `public` role. Production database users should be scoped to their
own schema only.

## Routes

CEDAR uses native App Router pages for the complete browse-to-order journey:

```text
/
/shop
/collections
/collections/[slug]
/search?q=
/products/[slug]
/compare
/cart
/checkout/contact
/checkout/delivery
/checkout/payment
/checkout/review
/orders/[id]/confirmation
/account
/account/orders
/account/orders/[id]
/account/addresses
/delivery
/returns
/support
/privacy
/terms
```

Its REST surface is under `/api/products`, `/api/collections`, `/api/search`,
`/api/cart`, `/api/checkout`, `/api/orders`, and `/api/account/orders`.
Server-side validation, stock checks, HTTP-only cart recovery, stable IDs and
idempotent order creation are enforced at these boundaries.

Partner Lab provides `/receivers/analytics`, `/receivers/advertising`,
`/receivers/crm`, `/deliveries/[id]`, and the corresponding signed
`/ingest/*` endpoints. Direct unsigned ingestion is rejected.

The authenticated CEDAR `/operator` route accepts only these values:
`normal`, `unauthorized-field`, `flash-sale`, `proportional-abuse`,
`shadow-integration`, and `stale-crm`. It does not accept arbitrary fields,
code, destinations or integration identifiers.

## Testing

```bash
# Frozen ThirdSight suite and production build
npm run quality

# CEDAR
cd services/cedar-commerce
npm run typecheck
npm test
npm run build
npm run test:e2e

# Partner Lab
cd ../partner-lab
npm run typecheck
npm test
npm run build
```

Set `CEDAR_E2E_URL` to a locally running server or the single preview deployment
before the browser suite. Run the suite once for desktop Chromium and once for
the configured mobile device project.

## Deployment

Create three separate Vercel projects with these roots:

```text
ThirdSight     -> repository root
CEDAR Commerce -> services/cedar-commerce
Partner Lab    -> services/partner-lab
```

Configure environment variables before building. Deploy one preview per
service, run the full cross-service browser test against those immutable URLs,
then promote those exact artifacts to production. Do not rebuild between a
passing preview and production promotion.

After the standalone CEDAR deployment is verified, replace the existing
embedded `/commerce-lab` experience with a redirect or launch page. Do not
remove it earlier, and do not change frozen verifier sources or historical
evidence.

## Canonical demonstration

1. Apply `supabase/migrations/009_managed_gateway_integrations.sql` and configure the managed-gateway and Partner Lab secrets.
2. Set CEDAR to `unauthorized-field`.
3. Complete a synthetic CEDAR checkout. The order is committed before optional integration delivery.
4. CEDAR sends an analytics body containing approved order/product fields plus `customer.phone` through `/api/managed-gateway?integration=cedar-analytics&environment=synthetic-demo`.
5. The merchant Purpose Contract does not approve `customer.phone` for analytics. The shared deterministic verifier emits `SCOPE_DRIFT`; the generic managed gateway removes only that field and forwards the remaining request.
6. Open Partner Lab's `managed-analytics` receiver and verify the analytics request arrived without `customer.phone`.
7. The same checkout sends a delivery request through `cedar-delivery`. Its separate merchant Purpose Contract explicitly approves `customer.phone` for fulfilment.
8. Open Partner Lab's `managed-delivery` receiver and verify the phone field is present there.
9. Inspect ThirdSight Activity / Integrations. The analytics request is `CONSTRAIN / PREVENTED`; the delivery request is `ALLOW`.
10. Run the 10-integration compatibility suite. It contains 60 automated cases and distinguishes `CONTROLLED_RECEIVER` from `SCHEMA_COMPATIBLE`; it does not claim a live vendor sandbox where one was not actually contacted.

The important proof is purpose differentiation, not a global PII rule: the same semantic field is removed for analytics and allowed for delivery because the merchant approved different purposes.
