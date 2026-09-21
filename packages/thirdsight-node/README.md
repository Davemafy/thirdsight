# @thirdsight/node

Dependency-free ESM client for ThirdSight's managed gateway. The package carries a request to ThirdSight; it does **not** reimplement policy or enforcement in the SDK.

## Preview install

The package is not published to the public npm registry yet. The recording-ready preview is distributed as a repository tarball:

```sh
npm install https://raw.githubusercontent.com/Davemafy/thirdsight/main/packages/thirdsight-node/thirdsight-node-0.1.0.tgz
```

`main` is intentionally used for the current preview distribution. Pin the URL to a release or commit once a registry/release publication process exists.

## Usage

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
  body: {
    order: { id: "order_123", value: 42000 },
    product: { id: "sku_123", category: "audio", price: 42000 },
    customer: { phone: "+2348000000000" },
  },
  context: {
    businessEvent: { id: "evt_123", type: "checkout.completed" },
  },
});
```

The client always targets `/api/managed-gateway`, sends the API key as a Bearer token, passes trusted request context through `x-thirdsight-context`, and uses `redirect: "manual"`. It accepts an integration ID and registered route path, never an arbitrary upstream URL. ThirdSight remains the enforcement authority.