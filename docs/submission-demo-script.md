# ThirdSight — ~2 minute judge demo

**Target runtime:** 1:55–2:05  
**Production:** https://thirdsight-five.vercel.app  
**Rule:** use persisted evidence only. Do not rerun benchmarks during judging.

## Before you start

1. Open **Overview**.
2. Make sure **Activity**, **Incidents**, **Integrations**, **Connections**, and **Validation** are visible in the navigation.
3. In **Activity**, confirm the representative ordering starts with normal controlled `ALLOW`, managed `PREVENTED`, then flash-sale `ALLOW`.
4. In **Incidents**, identify the readable rows for `PURPOSE_MISMATCH` and `SHADOW_INTEGRATION`.
5. Do not open devtools.

## Script

### 0:00–0:13 — the product and the challenge

**Stay on Overview.** Point to **Needs attention**, then the four proof facts.

“ThirdSight watches third-party integrations by comparing what a merchant approved with what an integration actually does. The same product proves the four things this challenge makes difficult: normal business can pass, abnormal partner behaviour can be caught, response is graded, and managed access can be stopped before data leaves.”

### 0:13–0:28 — normal traffic

**Click Activity → first normal row.**

“This is normal access. The approved scope, runtime evidence and first-party business context agree, so the deterministic layer allows it.”

Close the evidence drawer.

### 0:28–0:47 — scope violation, prevented

**Open the managed PREVENTED row.** Point to the stopped outcome, approved purpose, observed access, **Removed before send**, and **Forbidden field received: No**.

“Here the integration tries to include customer.phone outside its approved scope. ThirdSight removes only that field before transmission, lets the approved fields continue, and the receiver proves the phone never arrived. That is prevention, not detection.”

Close the drawer.

### 0:47–1:00 — busy legitimate sale

**Open the flash-sale ALLOW row.**

“A spike alone is not suspicious. At ten times normal sale traffic, the requests still correlate with real first-party business objects, so ThirdSight allows them and records no false alarm.”

Close the drawer.

### 1:00–1:14 — proportional abuse

**Click Incidents → open the row whose explanation says the access did not correlate with the expected business object.**

“Now the volume still looks plausible for the sale, but the business-object correlation fails. ThirdSight catches the purpose mismatch instead of using a blunt traffic threshold.”

Close the drawer.

### 1:14–1:31 — proof stops honestly

**Open the shadow-integration incident.** Expand **Verified Learning** only if needed.

“Here the destination is visible, but there is no registered integration identity or merchant purpose strong enough for deterministic enforcement. ThirdSight stays observational. A human-confirmed review outcome can raise review priority, but it cannot gain block authority.”

### 1:31–1:53 — real-world breadth + Vendor Intelligence

**Click Validation.** Point to the challenge proof row, then **Public web**, **Origin coverage**, and one **Vendor context** row.

“Outside the simulator, we also ran passive logged-out browser discovery. The Nigeria benchmark covered 40 sites, and the scale run attempted 1,000 high-traffic sites and indexed 3,354 unique origins. Where a vendor publishes documentation, ThirdSight adds the documented expected purpose and capability—but merchant approval stays separate.”

### 1:53–2:02 — close

“ThirdSight shows what integrations can reach and touch, catches when behaviour no longer matches the business purpose, and responds without treating normal commerce as an attack.”

## If a judge asks

**Do 3,354 origins mean 3,354 vendors?**  
“No. It means 3,354 unique browser-observed origins were indexed. Vendor identity and documentation coverage are tracked separately; unresolved origins stay unresolved.”

**Does vendor documentation mean the merchant approved that access?**  
“No. Vendor documentation describes the product’s expected purpose and documented capability. Merchant policy is the approval authority.”

**Is the 1,000-site run 10% of the market?**  
“No. It is a reproducible 1,000-site high-traffic public-web sample. We do not claim a market-share denominator.”

**Can the learning model block an integration?**  
“No. Verified Learning only prioritizes human review. Deterministic verification retains enforcement authority.”

**What if the network goes down?**  
“The current prototype treats that period as a coverage gap. It does not invent missing activity. Offline replay/enforcement guarantees would be connector-specific production work.”
