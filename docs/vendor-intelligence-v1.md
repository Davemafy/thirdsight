# Vendor Intelligence v1

**Status:** product capability  
**Registry version:** `vendor-intelligence-v1`  
**Reviewed:** 2026-09-20

## Product role

Vendor Intelligence turns a browser-visible destination into documented context when ThirdSight can resolve it to a known integration family.

It does **not** replace the frozen Stage 7 proof model and it does **not** turn public vendor documentation into merchant authorization.

ThirdSight keeps five product-facing questions separate:

| Product question | Strongest source | Meaning |
| --- | --- | --- |
| Expected | Vendor documentation | What the vendor documents the integration family as being designed to do |
| Approved | Merchant Purpose Contract | What this merchant actually authorized |
| Capable | Vendor documentation + merchant configuration/capability evidence | What the documented product can do, narrowed where local configuration is known |
| Observed | Runtime evidence | What ThirdSight actually saw happen |
| Context | First-party business event, with vendor use-case context as supporting evidence | What was happening in the customer journey when the observation occurred |

The authority boundary is explicit:

> Vendor documentation describes expected product purpose and documented capability. It does not establish merchant approval, merchant-specific configuration, runtime occurrence or enforcement authority.

## Evidence precedence

The useful product hierarchy is not a single trust score. Each source answers a different question:

1. **Merchant policy** owns approval authority.
2. **Vendor documentation** supplies documented purpose and capability context.
3. **Runtime observation** proves what was observed at the monitored boundary.
4. **Heuristic inference** is last-resort context and must remain labelled as inference.

Runtime observation can therefore be stronger than vendor documentation for **DID**, while merchant policy remains stronger for **APPROVED**.

## v1 registry

The first version intentionally starts with common integration families already visible in ThirdSight's public-site discovery results:

- Google tag / Tag Manager
- Google Analytics
- Google Ads / ad measurement
- Google Fonts
- Meta browser measurement family
- OneTrust Web CMP
- Microsoft Clarity
- Cloudflare Web Analytics
- LinkedIn Insight Tag
- Adobe Experience Platform Data Collection
- TikTok Pixel
- Cloudinary web delivery / upload
- Stripe.js / Elements

Every profile carries exact/suffix domain matchers, documented purposes, documented capabilities, documented event/data categories, first-party documentation URLs, a review date and explicit limitations.

## Domain resolution rules

A hostname match establishes only a **documented integration-family candidate**.

Examples:

- `www.googletagmanager.com` can identify Google tagging infrastructure, but cannot reveal which tags a merchant configured.
- `connect.facebook.net` can identify Meta browser infrastructure, but hostname evidence alone is not enough to assert one exact Meta product or event configuration.
- `fonts.gstatic.com` can be resolved to Google Fonts asset delivery without misclassifying a font request as analytics.
- an unknown hostname remains unresolved rather than being forced into a vendor family.

The resolver can also return multiple profiles when several documented families are represented by the destinations grouped into one integration row.

## Frozen-proof compatibility

Vendor Intelligence is currently **contextual enrichment**.

It does not:
- overwrite `SHOULD`;
- rewrite `COULD`;
- manufacture `WHY`;
- change a deterministic finding;
- grant `CONSTRAIN` or `ISOLATE`;
- alter `PREVENTED` / `DETECTED` semantics.

The original 40-site and 1,000-site persisted browser records retain their existing evidence semantics. Vendor recognition is post-hoc enrichment layered over those observations.

A future deterministic version may consume documented vendor capability only after a separately versioned acceptance and regression study against the frozen Stage 7 baseline.

## Product/API surface

`GET /api/vendor-intelligence` returns the versioned registry and its source metadata.

`GET /api/console-events` attaches a Vendor Intelligence resolution to each runtime event and integration exposure row.

The product console presents Vendor Intelligence as **Vendor documented**, merchant policy as **Merchant approved**, and browser/runtime observations as their actual evidence source. This makes missing merchant authorization visible rather than hiding it behind a generic UNKNOWN label.
