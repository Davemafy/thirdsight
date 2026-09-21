# Product onboarding - how another platform uses ThirdSight

ThirdSight is not one universal sensor. A customer chooses the evidence boundary that matches where a third-party integration touches data.

## Adoption flow

1. **Connect a boundary** - managed request path, browser sensor, or backend/audit source.
2. **Register the integration and its approved purpose** where the customer can provide that information.
3. **Stream privacy-reduced runtime evidence** into ThirdSight.
4. **Compare SHOULD / COULD / DID / WHY** using the evidence actually available at that boundary.
5. **Apply the smallest justified response**. Inline managed boundaries may prevent a field before send. Passive sensors remain observation/detection paths.
6. **Escalate unresolved cases to human review**. Verified Learning may prioritize review but never gains deterministic enforcement authority.

## Connection modes

### Managed gateway

Use this when a platform controls the server-side code that sends data to a third-party integration.

The platform registers the integration once. ThirdSight owns the upstream origin, allowed route and credential mapping server-side. The merchant application addresses ThirdSight by integration ID; it never supplies an arbitrary upstream URL.

A thin client is included in `src/sdk`:

```ts
import { ThirdSight } from "./src/sdk/index.js";

const thirdsight = new ThirdSight({
  baseUrl: "https://thirdsight.example",
  apiKey: process.env.THIRDSIGHT_GATEWAY_API_KEY!,
  environment: "production",
});

const paystack = thirdsight.integration("paystack");

const response = await paystack.fetch("/transaction/initialize", {
  method: "POST",
  body: payload,
  context: {
    businessEvent: {
      id: "checkout-2048",
      type: "checkout.started",
      orderRefHash,
    },
    requestRefs: { orderRefHash },
  },
});
```

The SDK is deliberately thin. Policy authority, Purpose Contracts, upstream resolution and credential injection remain in the gateway.

This is the strongest mode because it can support:

- authoritative SHOULD from a Purpose Contract;
- declared or known capability context;
- runtime DID evidence;
- first-party WHY/business-event correlation;
- field-level CONSTRAIN before transmission;
- a PREVENTED outcome only when ThirdSight controls the outbound request and evidence proves the disallowed field was excluded before transmission; an instrumented receiver can add independent non-receipt proof.

The managed path supports JSON request bodies, nested field paths and arrays. Unsupported body types are either blocked or explicitly forwarded in OBSERVE mode according to static integration configuration; they are never described as field-level enforced.

Security boundaries in the current implementation:

- only registered HTTPS upstream origins and registered method/path pairs are routable;
- client-supplied arbitrary upstream URLs are rejected by design;
- local, private, link-local and reserved address targets are rejected, including a DNS-resolution check before forwarding;
- caller credentials, cookies and hop-by-hop headers are not forwarded;
- third-party credentials are injected after policy evaluation from server-side environment configuration;
- redirects are not followed automatically;
- POST/PATCH requests are not automatically retried;
- request and response sizes are bounded;
- failure behavior is explicit per integration as `CLOSED` or `ALLOW_AND_AUDIT`.

Commerce Lab now has a canonical managed path where the same `customer.phone` field is constrained for analytics but allowed for delivery because those two merchant Purpose Contracts authorize different uses.

### Browser sensor

Use this for frontend integrations, tags and browser-visible third-party destinations.

The existing prototype sensor is configured with:

```js
chrome.runtime.sendMessage({
  type: "THIRDSIGHT_SET_INGESTION_CONFIG",
  endpoint: "https://<thirdsight-host>/api/browser-observations",
  token: "<installation-token>"
})
```

The sensor emits privacy-reduced browser metadata. It does not forward observed request bodies, cookies, request headers, query strings, fragments or form values.

Browser observation means:

- DID can be directly observed;
- COULD is a partial browser-visible lower bound;
- SHOULD remains UNKNOWN unless the merchant separately provides an approved Purpose Contract;
- WHY remains UNKNOWN unless authoritative first-party context is separately supplied;
- the observation path is not described as preventing a request that has already been observed.

### Audit / backend evidence

Use this where an existing integration cannot be placed behind an inline managed boundary.

Database or gateway audit evidence can establish post-access DID and support deterministic findings such as stale integration use. If a connected control plane supports it, ThirdSight can contain future credential use.

Already-observed access remains DETECTED rather than PREVENTED.

## Network-loss behavior

The current prototype does not claim uninterrupted central visibility while disconnected.

The browser sensor can retain a rolling local session buffer when ingestion is not configured, but the product should treat disconnected periods as explicit coverage gaps rather than infer missing evidence. A production deployment should define buffering, replay, expiry and local enforcement guarantees per connector before claiming offline continuity.

## Product rule

Connection mode changes what ThirdSight can prove.

The UI must therefore expose coverage state next to every decision instead of flattening managed, browser-only and audit evidence into the same certainty level.

## Recording-ready self-service provisioning

The current Connections flow can create a merchant workspace, install either the fixed CEDAR Analytics or CEDAR Delivery preset, approve its server-owned Purpose Contract, issue a one-time merchant-scoped key, and execute a real managed request. The browser cannot supply arbitrary upstreams, routes or Purpose Contracts. Merchant evidence is tagged in persistence and remains visible in the operator dashboard. The preview still uses a shared privileged operator setup secret and is not yet a full multi-user SaaS account system.

For the installable Node preview and current limitations, see [self-service-control-plane.md](self-service-control-plane.md).
