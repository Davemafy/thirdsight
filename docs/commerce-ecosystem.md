# ThirdSight Commerce Lab

This document covers the independently deployable CEDAR Commerce store,
ThirdSight managed gateway, and Partner Lab receiver. CEDAR is a fictional
Nigerian consumer-technology retailer. All people, addresses, phone numbers,
payments and orders used by the lab are synthetic.

## Runtime topology

```text
Shopper -> CEDAR storefront -> CEDAR API -> cedar_commerce schema
CEDAR order event -> ThirdSight /api/gateway/v1/dispatch
ThirdSight -> purpose contract + field enforcement -> Partner Lab
ThirdSight -> immutable evidence history + gateway_dispatches
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
| `THIRDSIGHT_GATEWAY_URL` | Exact ThirdSight dispatch URL |
| `THIRDSIGHT_MERCHANT_ID` | Fixed value `cedar-commerce` |
| `THIRDSIGHT_INTEGRATION_SECRET` | HMAC secret shared only with ThirdSight |
| `OPERATOR_ACCESS_SECRET` | Bearer secret for the fixed-enum operator route |
| `NEXT_PUBLIC_STORE_URL` | Public CEDAR origin; not a secret |

### ThirdSight

The existing `THIRDSIGHT_SUPABASE_URL` and
`THIRDSIGHT_SUPABASE_SERVICE_ROLE_KEY` remain server-only. The gateway adds:

| Variable | Purpose |
| --- | --- |
| `CEDAR_INTEGRATION_SECRET` | Verifies CEDAR request signatures |
| `CEDAR_COMMERCE_URL` | Exact CORS origin for CEDAR |
| `PARTNER_ANALYTICS_URL` | Registered analytics receiver URL |
| `PARTNER_ADVERTISING_URL` | Registered advertising receiver URL |
| `PARTNER_CRM_URL` | Registered CRM receiver URL |
| `PARTNER_GATEWAY_SECRET` | Signs ThirdSight-to-partner requests |

### Partner Lab

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Server-only pooled PostgreSQL connection with access limited to `partner_lab` |
| `THIRDSIGHT_PARTNER_SECRET` | Verifies ThirdSight gateway signatures |
| `ALLOWED_GATEWAY_ORIGIN` | Optional exact browser-origin allowlist; HMAC remains mandatory |

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

1. Set the server-side scenario to `unauthorized-field` through `/operator`.
2. In CEDAR, search for `Auralite`, open its real product route, choose a finish
   and configuration, add it to the persistent cart, and change the quantity.
3. Complete contact, delivery and synthetic-payment steps and place the order.
4. Record the CEDAR order ID and order number from the confirmation route.
5. Confirm the CEDAR `integration_events` row attempted approved order/product
   fields plus `customer.phone`.
6. Open the ThirdSight evidence record returned by the gateway. It must show
   `PREVENTED`, `SCOPE_DRIFT`, and `customer.phone` as the only blocked field.
7. Open the matching Partner Lab delivery. It must contain `order.id`,
   `order.value`, `product.id`, and `product.category`, and must not contain
   `customer.phone`.
8. Confirm the order remains `CONFIRMED`.
9. Repeat in `normal` mode and confirm approved traffic is delivered without a
   false block.

A release handoff is valid only when it includes the three production URLs,
repository and commit, order ID, integration-event ID, ThirdSight evidence ID,
Partner Lab delivery ID, and successful response checks for all services.
