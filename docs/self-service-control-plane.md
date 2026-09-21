# Recording-ready merchant self-service

ThirdSight's current self-service flow is a constrained control-plane preview, not a complete multi-user SaaS account system.

## Flow

1. An operator opens **Connections** in ThirdSight and supplies the shared setup secret.
2. The operator creates a merchant workspace and chooses one fixed integration preset: `cedar-analytics` or `cedar-delivery`.
3. The UI shows the preset Purpose Contract before provisioning. The browser can approve the fixed preset, but cannot supply arbitrary receivers, routes, policies, execution code or upstream URLs.
4. The control plane stores the workspace and preset Purpose Contract, then creates a merchant API key. Only a SHA-256 hash plus non-secret display metadata are persisted; the raw key is returned once.
5. The merchant sends a managed request to `/api/managed-gateway`. Merchant-key authentication is resolved server-side and the requested integration must be actively installed for that same merchant.
6. The existing deterministic verifier evaluates the merchant-scoped Purpose Contract and first-party context. The SDK does not duplicate enforcement.
7. ThirdSight persists evidence with the merchant ID and forwards only the permitted body to the server-owned registered upstream.

## CEDAR proof presets

### Analytics — CONSTRAIN

The Analytics Purpose Contract approves commerce measurement fields but does **not** approve `customer.phone`. The Connections test deliberately includes a phone number alongside approved order and product fields. ThirdSight should return `CONSTRAIN`, remove only `customer.phone`, forward the approved remainder, persist the merchant-scoped evidence, and return Partner Lab's real receipt. The receipt's `receivedFields` is the independent observable used in the recording.

### Delivery — ALLOW

The Delivery Purpose Contract explicitly approves `customer.phone` with the delivery address and line-item fields needed for fulfilment. The equivalent managed request should return `ALLOW`, and Partner Lab's receipt should include `customer.phone`.

## Node client preview

`@thirdsight/node` is not yet published to the npm registry. The recording build ships an installable package tarball in this repository:

```bash
npm install https://raw.githubusercontent.com/Davemafy/thirdsight/main/packages/thirdsight-node/thirdsight-node-0.1.0.tgz
```

```js
import { ThirdSight } from "@thirdsight/node";

const thirdsight = new ThirdSight({
  baseUrl: "https://thirdsight-one.vercel.app",
  apiKey: process.env.THIRDSIGHT_API_KEY,
  environment: "synthetic-demo",
});

const analytics = thirdsight.integration("cedar-analytics");
const response = await analytics.fetch("/ingest/managed/analytics", {
  method: "POST",
  body: payload,
  context: {
    businessEvent: { id: "checkout-2048", type: "checkout.completed" },
  },
});
```

The client validates an HTTPS ThirdSight base URL and integration identifier, always uses `redirect: "manual"`, sends only to ThirdSight's managed-gateway endpoint, and never accepts an arbitrary upstream origin. Vendor credentials, registered routes, SSRF protections, request-size limits, Purpose Contracts and enforcement stay server-owned.

## Current limitations

- Setup still uses one shared privileged operator secret.
- There is no end-user sign-in, tenant-facing RBAC, billing, or key-rotation UI.
- The Node client is a repository-hosted preview tarball, not an npm-registry release.
- Vendor/upstream credentials remain environment-managed by ThirdSight.
- Self-service onboarding exposes only fixed safe presets; merchants cannot author arbitrary upstreams or Purpose Contracts from the browser.
- The existing dashboard is an operator console. Merchant evidence is scoped in persistence, but this preview is not yet a tenant-isolated dashboard/account product.

These limitations are intentional for the recording build and should not be hidden or weakened merely to make the demo appear more complete.