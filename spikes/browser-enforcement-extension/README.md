# Browser enforcement feasibility spike

This spike answers two questions only:

1. Can a Manifest V3 extension observe live browser requests on a user-authorized tab?
2. Can it pause a managed JSON analytics request before transmission, remove `customer.phone`, and continue the modified request?

No production architecture should depend on this spike until both questions are verified in Chrome.

## Mechanism under test

The extension uses `chrome.debugger` as the transport for Chrome DevTools Protocol (CDP):

- `Network.enable` + `Network.requestWillBeSent` for passive request metadata.
- `Fetch.enable` with a narrow URL pattern for the Commerce Lab spike endpoint.
- `Fetch.requestPaused` to pause the matching request before it is sent.
- `Fetch.continueRequest` with overridden base64-encoded `postData` after deleting `customer.phone`.

The extension deliberately stores only request metadata for general browsing. It does not persist arbitrary public-site request bodies.

## Run the Commerce Lab proof

From `commerce-lab/`:

```bash
npm install
npm run dev
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked** and select `spikes/browser-enforcement-extension/`.
4. Open `http://localhost:3000/spike/browser-enforcement`.
5. Click the ThirdSight extension action once. The badge should read `ON`; Chrome will show its debugger-attached warning.
6. Click **Send attempted analytics event**.

Expected receiver result when enforcement works:

```text
customer.phone reached receiver: NO — field was prevented
```

The receiver should report these fields:

```text
event
product.id
product.category
product.price
```

and should not report:

```text
customer.phone
```

To inspect the spike evidence, open the extension service worker console from `chrome://extensions` and run:

```js
chrome.storage.session.get(['lastEnforcement', 'observations']).then(console.log)
```

`lastEnforcement.outcome` should be `PREVENTED`, with `customer.phone` present in `beforeFields`, absent from `afterFields`, and listed in `removed`.

Click the extension action again to detach.

## Passive discovery check

Use a logged-out public commerce site only. Do not sign in, enter personal information, or submit payment details during this spike.

1. Open the public site.
2. Click the extension action to attach.
3. Browse ordinary public pages.
4. Inspect `observations` in the service worker console.

The extension should record destination origin/path, method, resource type, initiator type, timestamp, and whether post data existed. This proves browser-visible discovery only; it does not establish the merchant's `SHOULD` or authoritative `WHY`.

## Decision gate

Record the result exactly as one of these outcomes:

```text
OBSERVATION WORKS / OBSERVATION FAILS
ENFORCEMENT WORKS / ENFORCEMENT FAILS
```

If observation works but JSON-body rewriting is unreliable, keep the extension as a browser discovery sensor and move pre-send field enforcement to the managed SDK/server-egress proxy. Do not broaden the extension until this spike is reproducible.

## Known limitations of this spike

- `chrome.debugger` produces a visible debugger-attached warning and requires the `debugger` permission.
- This implementation only rewrites a narrow JSON request pattern owned by Commerce Lab.
- It does not prove arbitrary rewriting for multipart bodies, compressed/proprietary SDK formats, WebSocket messages, WebTransport, service-worker-internal behavior, or server-to-server traffic.
- General browsing observations are browser-boundary evidence only.
- Chrome enterprise policy can restrict debugger attachment on managed devices.
