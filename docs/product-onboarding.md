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

### Managed request boundary

Use this when a platform controls the code that sends data to a third-party integration.

The platform supplies authoritative purpose/context and routes the outbound integration request through ThirdSight's managed verification boundary.

This is the strongest mode because it can support:

- authoritative SHOULD from a Purpose Contract;
- declared or known capability context;
- runtime DID evidence;
- first-party WHY/business-event correlation;
- field-level CONSTRAIN before transmission;
- a PREVENTED outcome only when receiver non-receipt is proven.

This prototype proves the flow in Commerce Lab. It is not yet packaged as a public one-line SDK.

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
