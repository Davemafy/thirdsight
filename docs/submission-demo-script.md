# ThirdSight - ~2 minute judge demo

**Target runtime:** 1:55-2:05  
**Production console:** https://thirdsight-five.vercel.app  
**Rule:** Do not open devtools. Do not rerun benchmarks. Use only persisted evidence already visible in the console.

## Pre-demo setup

1. Open the production console.
2. Set browser zoom so the header, Track G exposure section and **Real-world validation** section are readable without horizontal scrolling.
3. Leave the first sidebar item selected.
4. Confirm the top proof cards show the persisted busy-sale and managed-prevention evidence.
5. Confirm the Real-world validation panel shows: **40 attempted, 30 loaded, 203 observations, 118 unique origins, 30/30 loaded sites with cross-origin evidence**.
6. In the sidebar, identify the representative items by their sublabels/records before speaking:
   - first normal `ALLOW`;
   - `PREVENTED` managed scope case;
   - flash-sale `ALLOW`;
   - `PURPOSE_MISMATCH` case;
   - the unresolved `OBSERVE` shadow case used by Verified Learning.

## Click-by-click script

### 0:00-0:12 - thesis and validation split
**No click.** Point at the header, then the two validation environments.

Say:

"ThirdSight watches third-party integrations by separating four questions: what they should access, could access, did access, and why the business needed it. The key is we only claim what the evidence can support: Commerce Lab gives us ground truth; public sites give us discovery breadth."

### 0:12-0:27 - normal legitimate traffic
**Click:** sidebar item with `ALLOW` for the normal controlled integration.

Point to SHOULD / COULD / DID / WHY, then the action panel.

Say:

"Here the approved scope, observed access and first-party business context agree, so the frozen deterministic layer returns ALLOW."

### 0:27-0:47 - scope violation and prevention
**Click:** sidebar item with `PREVENTED`.

Point to `SCOPE_DRIFT`, `CONSTRAIN`, "Removed before send", and "customer.phone at receiver: NO".

Say:

"Now the integration tries to include customer.phone outside its contract. ThirdSight constrains only that field before transmission. The legitimate fields continue, and the receiver record proves the phone never arrived - so this is PREVENTED, not merely detected."

### 0:47-1:01 - 10x legitimate flash sale
**Click:** sidebar flash-sale item with `ALLOW`.

Point back to the **Busy sales day** proof card.

Say:

"A busy sales day is not automatically suspicious. At ten times normal traffic, matching first-party business objects still justify the requests, so ThirdSight allows them and records zero false alarms."

### 1:01-1:15 - proportional abuse
**Click:** the representative controlled record whose finding is `PURPOSE_MISMATCH`.

Point to the finding and response.

Say:

"But proportional abuse can hide inside the same plausible volume. Here volume still looks normal for the sale, while business-object correlation fails. ThirdSight catches the mismatch instead of relying on traffic volume alone."

### 1:15-1:39 - proof stops, learning begins
**Click:** unresolved shadow-integration `OBSERVE` record used by Verified Learning.

Point first to the UNKNOWN/PARTIAL evidence, then scroll just enough to show the Verified Learning panel.

Say:

"Here proof genuinely stops. We observed the destination, but the Purpose Contract and business justification are unknown, so deterministic enforcement stays OBSERVE. A human confirmed REVIEW. That one verified example retrained the advisory priority model; the unchanged frozen benchmark promoted h1, while the deterministic result stayed OBSERVE. Learning changed review priority, not authority."

If visible, point to:
- deterministic result unchanged;
- human-confirmed REVIEW;
- `stage9-priority-v3-h1`;
- 1 verified example;
- PROMOTED;
- advisory-only boundary.

### 1:39-1:57 - real-world breadth
**Scroll:** back to **Real-world validation**.

Point to the public benchmark metrics and the SHOULD / COULD / DID / WHY strip.

Say:

"Finally, outside the lab we passively tested 40 Nigeria-facing public sites. Thirty loaded normally; all 30 produced browser-visible cross-origin evidence. We persisted 203 observations across 118 unique destination origins. But notice the boundary: SHOULD and WHY stay unknown, COULD stays partial, and coverage is browser-only. We do not call these merchants malicious or claim backend access."

### 1:57-2:02 - close
**No click.**

Say:

"That is ThirdSight: prove what can be proven, and learn where proof stops."

## If the judge interrupts

- **"Is 95.833% real-world accuracy?"** - "No. It is the frozen 96-case synthetic residual benchmark after one human-verified example. The 40-site run is separate discovery-breadth evidence."
- **"Did you hack or bypass the 40 sites?"** - "No. Public logged-out homepages only; no auth, forms, fuzzing, request mutation, anti-bot bypass or private data."
- **"Can the model block an integration?"** - "No. Verified Learning only ranks review priority. Stage 7 deterministic verification retains all CONSTRAIN / ISOLATE authority."
- **"Why are 10 sites missing?"** - "They were blocked, timed out or unavailable from the runner, and the harness recorded them as unavailable instead of attempting a bypass."
