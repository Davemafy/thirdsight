import { chromium } from "playwright";
import fs from "node:fs/promises";
import crypto from "node:crypto";

const base = process.env.THIRDSIGHT_URL ?? "https://thirdsight-five.vercel.app";
const MAX_PERSISTED_PER_SITE = 8;
const CONCURRENCY = 3;
const NAVIGATION_TIMEOUT_MS = 25_000;
const DWELL_MS = 4_500;

const SITES = [
  { slug:"jumia", name:"Jumia Nigeria", category:"retail-marketplace", url:"https://www.jumia.com.ng/" },
  { slug:"konga", name:"Konga", category:"retail-marketplace", url:"https://www.konga.com/" },
  { slug:"jiji", name:"Jiji Nigeria", category:"retail-marketplace", url:"https://jiji.ng/" },
  { slug:"slot", name:"Slot", category:"retail", url:"https://slot.ng/" },
  { slug:"pointek", name:"Pointek", category:"retail", url:"https://www.pointekonline.com/" },
  { slug:"kara", name:"Kara", category:"retail", url:"https://kara.com.ng/" },
  { slug:"fouani", name:"Fouani", category:"retail", url:"https://www.fouani.com/" },
  { slug:"istore-ng", name:"iStore Nigeria", category:"retail", url:"https://www.istore.com.ng/" },
  { slug:"supermart", name:"Supermart.ng", category:"retail-grocery", url:"https://www.supermart.ng/" },
  { slug:"market-square", name:"Market Square Nigeria", category:"retail-grocery", url:"https://marketsquareng.com/" },
  { slug:"shoprite-ng", name:"Shoprite Nigeria", category:"retail-grocery", url:"https://shoprite.ng/" },
  { slug:"spar-ng", name:"SPAR Nigeria", category:"retail-grocery", url:"https://sparnigeria.com/" },
  { slug:"oraimo-ng", name:"Oraimo Nigeria", category:"consumer-electronics", url:"https://ng.oraimo.com/" },
  { slug:"samsung-ng", name:"Samsung Africa / Nigeria-facing", category:"consumer-electronics", url:"https://www.samsung.com/africa_en/" },
  { slug:"tecno-ng", name:"TECNO Nigeria", category:"consumer-electronics", url:"https://www.tecno-mobile.com/ng/" },
  { slug:"infinix-ng", name:"Infinix Nigeria", category:"consumer-electronics", url:"https://ng.infinixmobility.com/" },

  { slug:"paystack", name:"Paystack", category:"payments-fintech", url:"https://paystack.com/" },
  { slug:"flutterwave-ng", name:"Flutterwave Nigeria", category:"payments-fintech", url:"https://flutterwave.com/ng/" },
  { slug:"moniepoint-ng", name:"Moniepoint Nigeria", category:"payments-fintech", url:"https://moniepoint.com/ng/" },
  { slug:"opay", name:"OPay", category:"payments-fintech", url:"https://www.opayweb.com/" },
  { slug:"palmpay", name:"PalmPay", category:"payments-fintech", url:"https://www.palmpay.com/" },
  { slug:"interswitch", name:"Interswitch", category:"payments-fintech", url:"https://www.interswitchgroup.com/" },
  { slug:"remita", name:"Remita", category:"payments-fintech", url:"https://www.remita.net/" },
  { slug:"cowrywise", name:"Cowrywise", category:"consumer-fintech", url:"https://cowrywise.com/" },
  { slug:"piggyvest", name:"PiggyVest", category:"consumer-fintech", url:"https://www.piggyvest.com/" },
  { slug:"risevest", name:"Risevest", category:"consumer-fintech", url:"https://risevest.com/" },
  { slug:"kuda", name:"Kuda", category:"consumer-fintech", url:"https://kuda.com/" },
  { slug:"fairmoney", name:"FairMoney", category:"consumer-fintech", url:"https://fairmoney.io/" },
  { slug:"carbon", name:"Carbon", category:"consumer-fintech", url:"https://getcarbon.co/" },

  { slug:"bumpa", name:"Bumpa", category:"merchant-commerce", url:"https://getbumpa.com/" },
  { slug:"selar", name:"Selar", category:"merchant-commerce", url:"https://selar.com/" },
  { slug:"sabi", name:"Sabi", category:"b2b-commerce", url:"https://sabi.am/" },
  { slug:"omniretail", name:"OmniRetail", category:"b2b-commerce", url:"https://omniretail.africa/" },
  { slug:"tradedepot", name:"TradeDepot", category:"b2b-commerce", url:"https://www.tradedepot.co/" },

  { slug:"gig-logistics", name:"GIG Logistics", category:"logistics-delivery", url:"https://giglogistics.com/" },
  { slug:"sendbox", name:"Sendbox", category:"logistics-delivery", url:"https://sendbox.co/" },
  { slug:"kwik", name:"Kwik", category:"logistics-delivery", url:"https://kwik.delivery/" },
  { slug:"chowdeck", name:"Chowdeck", category:"food-commerce-delivery", url:"https://chowdeck.com/" },
  { slug:"glovo-ng", name:"Glovo Nigeria", category:"food-commerce-delivery", url:"https://glovoapp.com/ng/en/" },
  { slug:"dhl-ng", name:"DHL Nigeria", category:"logistics-delivery", url:"https://www.dhl.com/ng-en/home.html" },
];

if (SITES.length !== 40) throw new Error(`Expected 40 benchmark sites, received ${SITES.length}.`);

const browser = await chromium.launch({
  headless: true,
  args: [
    "--disable-dev-shm-usage",
    "--no-default-browser-check",
    "--disable-background-networking",
  ],
});

const runId = `ng40-${Date.now()}`;
let cachedToken = process.env.THIRDSIGHT_OIDC_TOKEN?.trim() || null;
const results = new Array(SITES.length);
let cursor = 0;

try {
  await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, index) => worker(index + 1)),
  );

  const report = buildReport(results);
  await fs.writeFile("stage6-ng40-discovery.json", JSON.stringify(report, null, 2));
  await fs.writeFile("stage6-ng40-discovery.md", renderMarkdown(report));
  console.log("THIRDSIGHT_NG40_REPORT=" + JSON.stringify({
    runId: report.runId,
    sitesAttempted: report.summary.sitesAttempted,
    sitesLoadedNormally: report.summary.sitesLoadedNormally,
    sitesWithCrossOriginEvidence: report.summary.sitesWithCrossOriginEvidence,
    observationsPersisted: report.summary.observationsPersisted,
    uniqueCrossOriginOrigins: report.summary.uniqueCrossOriginOrigins,
    blockedOrFailed: report.summary.blockedOrFailed,
  }));
} finally {
  await browser.close();
}

async function worker(workerId) {
  while (true) {
    const index = cursor++;
    if (index >= SITES.length) return;
    const site = SITES[index];
    results[index] = await inspectSite(site, workerId);
  }
}

async function inspectSite(site, workerId) {
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
    locale: "en-NG",
    timezoneId: "Africa/Lagos",
    serviceWorkers: "allow",
  });
  const page = await context.newPage();
  const requests = [];
  const errors = [];
  let responseStatus = null;
  let finalUrl = null;
  let loadedNormally = false;

  page.on("request", (request) => {
    const destinationUrl = sanitizeHttpUrl(request.url());
    if (!destinationUrl) return;
    requests.push({
      destinationUrl,
      method: request.method().toUpperCase(),
      resourceType: normalizeResourceType(request.resourceType()),
    });
  });

  page.on("pageerror", (error) => {
    if (errors.length < 3) errors.push(`pageerror: ${String(error.message ?? error).slice(0, 180)}`);
  });

  try {
    console.log(`[worker ${workerId}] ${site.name}: loading ${site.url}`);
    const response = await page.goto(site.url, {
      waitUntil: "domcontentloaded",
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    responseStatus = response?.status() ?? null;
    finalUrl = sanitizeHttpUrl(page.url());
    loadedNormally = responseStatus !== null && responseStatus >= 200 && responseStatus < 400;

    if (!loadedNormally) {
      errors.push(`Navigation returned HTTP ${responseStatus ?? "unknown"}; no bypass attempted.`);
    } else {
      await page.waitForTimeout(DWELL_MS);
    }
  } catch (error) {
    finalUrl = sanitizeHttpUrl(page.url());
    errors.push(`Navigation failed: ${error instanceof Error ? error.message.slice(0, 220) : String(error).slice(0, 220)}`);
  }

  const pageUrl = finalUrl ?? sanitizeHttpUrl(site.url);
  const pageOrigin = pageUrl ? new URL(pageUrl).origin : new URL(site.url).origin;
  const crossOrigin = requests.filter((item) => {
    try {
      return new URL(item.destinationUrl).origin !== pageOrigin;
    } catch {
      return false;
    }
  });

  const representative = dedupeRepresentative(crossOrigin).slice(0, MAX_PERSISTED_PER_SITE);
  const persisted = [];

  if (loadedNormally) {
    for (const [index, item] of representative.entries()) {
      const observation = {
        schemaVersion: "browser-observation.v1",
        observationId: `${runId}-${site.slug}-${index + 1}-${crypto.randomUUID()}`,
        sensorId: `benchmark40:${site.slug}`,
        observedAt: new Date().toISOString(),
        pageUrl,
        destinationUrl: item.destinationUrl,
        method: item.method,
        resourceType: item.resourceType,
        initiatorType: "passive-page-load",
        // We deliberately do not inspect request bodies in this benchmark.
        hasPostData: false,
      };

      try {
        const accepted = await persistObservation(observation);
        assertDiscoverySemantics(accepted);
        persisted.push({
          recordId: accepted.evidence?.recordId ?? null,
          destinationOrigin: accepted.evidence?.did?.value?.destinationOrigin ?? new URL(item.destinationUrl).origin,
          destinationPath: accepted.evidence?.did?.value?.destinationPath ?? new URL(item.destinationUrl).pathname,
          method: item.method,
          resourceType: item.resourceType,
          integrationResolution: accepted.integrationResolution?.status ?? null,
        });
      } catch (error) {
        errors.push(`Persistence failed: ${error instanceof Error ? error.message.slice(0, 220) : String(error).slice(0, 220)}`);
      }
    }
  }

  await context.close();

  const uniqueOrigins = [...new Set(crossOrigin.map((item) => new URL(item.destinationUrl).origin))].sort();
  console.log(
    `[worker ${workerId}] ${site.name}: HTTP ${responseStatus ?? "-"}, ${uniqueOrigins.length} cross-origin origins, ${persisted.length} persisted`,
  );

  return {
    slug: site.slug,
    name: site.name,
    category: site.category,
    requestedUrl: site.url,
    finalUrl,
    responseStatus,
    loadedNormally,
    requestsObserved: requests.length,
    crossOriginRequestsObserved: crossOrigin.length,
    uniqueCrossOriginOrigins: uniqueOrigins,
    persistedObservations: persisted,
    dataCategories: [],
    dataCategoryStatus: "Not inferred: request bodies, cookies, response bodies, and PII-bearing values were not inspected.",
    errors,
  };
}

function dedupeRepresentative(items) {
  const byOrigin = new Map();
  for (const item of items) {
    const origin = new URL(item.destinationUrl).origin;
    if (!byOrigin.has(origin)) byOrigin.set(origin, item);
  }
  return [...byOrigin.values()];
}


async function persistObservation(observation) {
  let response = await postWithToken(observation, await getToken(false));
  if (response.status === 401) {
    cachedToken = null;
    response = await postWithToken(observation, await getToken(true));
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.accepted !== true || body?.persisted !== true) {
    throw new Error(`ingestion HTTP ${response.status}: ${JSON.stringify(body).slice(0, 500)}`);
  }
  return body;
}

async function postWithToken(observation, token) {
  return fetch(`${base}/api/browser-observations`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(observation),
  });
}

async function getToken(forceRefresh) {
  if (!forceRefresh && cachedToken) return cachedToken;
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL?.trim();
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN?.trim();
  if (!requestUrl || !requestToken) {
    throw new Error("GitHub OIDC environment is unavailable for Stage 6 benchmark ingestion.");
  }
  const separator = requestUrl.includes("?") ? "&" : "?";
  const response = await fetch(`${requestUrl}${separator}audience=thirdsight-stage6`, {
    headers: { authorization: `bearer ${requestToken}` },
  });
  if (!response.ok) throw new Error(`GitHub OIDC refresh failed (${response.status}).`);
  const body = await response.json();
  if (typeof body?.value !== "string" || body.value.length === 0) {
    throw new Error("GitHub OIDC refresh returned no token.");
  }
  cachedToken = body.value;
  return cachedToken;
}

function assertDiscoverySemantics(body) {
  const evidence = body?.evidence;
  const checks = [
    [evidence?.should?.status, "UNKNOWN", "SHOULD"],
    [evidence?.could?.status, "PARTIAL", "COULD"],
    [evidence?.did?.status, "KNOWN", "DID"],
    [evidence?.did?.confidence, "OBSERVED", "DID confidence"],
    [evidence?.why?.status, "UNKNOWN", "WHY"],
    [evidence?.coverage?.label, "BROWSER_ONLY", "coverage"],
  ];
  for (const [actual, expected, label] of checks) {
    if (actual !== expected) throw new Error(`${label} expected ${expected}, received ${actual}`);
  }
}

function sanitizeHttpUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.origin}${sanitizePathname(url.pathname)}`;
  } catch {
    return null;
  }
}

function sanitizePathname(pathname) {
  const segments = pathname.split("/").map((segment) => {
    if (!segment) return segment;
    if (/^\d{6,}$/.test(segment)) return ":id";
    if (/^[0-9a-f]{16,}$/i.test(segment)) return ":id";
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment)) return ":id";
    if (segment.length > 64) return ":opaque";
    return segment;
  });
  return segments.join("/") || "/";
}

function normalizeResourceType(value) {
  const normalized = String(value || "other").toLowerCase();
  const table = {
    document:"Document", stylesheet:"Stylesheet", image:"Image", media:"Media",
    font:"Font", script:"Script", texttrack:"TextTrack", xhr:"XHR", fetch:"Fetch",
    eventsource:"EventSource", websocket:"WebSocket", manifest:"Manifest", other:"Other",
  };
  return table[normalized] ?? "Other";
}

function buildReport(siteResults) {
  const loaded = siteResults.filter((site) => site.loadedNormally);
  const withEvidence = siteResults.filter((site) => site.persistedObservations.length > 0);
  const destinationStats = new Map();
  let observationsPersisted = 0;

  for (const site of siteResults) {
    observationsPersisted += site.persistedObservations.length;
    for (const observation of site.persistedObservations) {
      const current = destinationStats.get(observation.destinationOrigin) ?? { origin:observation.destinationOrigin, sites:new Set(), observations:0 };
      current.sites.add(site.name);
      current.observations += 1;
      destinationStats.set(observation.destinationOrigin, current);
    }
  }

  const topDestinations = [...destinationStats.values()]
    .sort((a,b) => b.sites.size - a.sites.size || b.observations - a.observations || a.origin.localeCompare(b.origin))
    .slice(0, 30)
    .map((item) => ({ origin:item.origin, siteCount:item.sites.size, observations:item.observations, sites:[...item.sites].sort() }));

  const categoryStats = Object.values(siteResults.reduce((acc,site) => {
    const row = acc[site.category] ?? { category:site.category, attempted:0, loaded:0, withEvidence:0, persisted:0 };
    row.attempted += 1;
    if (site.loadedNormally) row.loaded += 1;
    if (site.persistedObservations.length > 0) row.withEvidence += 1;
    row.persisted += site.persistedObservations.length;
    acc[site.category] = row;
    return acc;
  }, {})).sort((a,b) => a.category.localeCompare(b.category));

  return {
    schemaVersion: "thirdsight-ng40-discovery.v1",
    runId,
    generatedAt: new Date().toISOString(),
    mode: "public logged-out passive homepage discovery",
    thesis: "Real-site breadth validates discovery coverage only; Commerce Lab remains the ground-truth environment for abuse, prevention, and false-positive evaluation.",
    summary: {
      sitesAttempted: siteResults.length,
      sitesLoadedNormally: loaded.length,
      blockedOrFailed: siteResults.length - loaded.length,
      sitesWithCrossOriginEvidence: withEvidence.length,
      observationsPersisted,
      uniqueCrossOriginOrigins: destinationStats.size,
    },
    evidenceSemantics: {
      should: "Not provided / UNKNOWN",
      could: "Partial / browser-visible lower bound",
      did: "Observed request metadata",
      why: "Not available / UNKNOWN",
      coverage: "Browser only",
      enforcementClaim: "None. Public discovery does not claim PREVENTED or DETECTED.",
    },
    safety: {
      publicPagesOnly: true,
      loggedOutOnly: true,
      navigationOnly: true,
      formsSubmitted: false,
      authenticationUsed: false,
      fuzzingUsed: false,
      requestMutationUsed: false,
      controlsBypassed: false,
      requestBodiesInspected: false,
      responseBodiesInspectedForTelemetry: false,
      cookiesPersisted: false,
      queryStringsPersisted: false,
      rawCustomerPayloadsPersisted: false,
      piiPersisted: false,
      botChallengesBypassed: false,
      note: "A non-2xx/3xx response, timeout, CAPTCHA, or bot challenge is recorded as unavailable; the harness does not attempt a bypass.",
    },
    categoryStats,
    topDestinations,
    sites: siteResults,
  };
}

function renderMarkdown(report) {
  const lines = [
    "# ThirdSight — 40-site Nigeria-facing passive discovery benchmark",
    "",
    `**Run:** \`${report.runId}\`  `,
    `**Generated:** ${report.generatedAt}  `,
    `**Mode:** ${report.mode}`,
    "",
    "## Result",
    "",
    `- Sites attempted: **${report.summary.sitesAttempted}**`,
    `- Loaded normally without bypass: **${report.summary.sitesLoadedNormally}**`,
    `- Blocked / failed / unavailable: **${report.summary.blockedOrFailed}**`,
    `- Sites with persisted cross-origin evidence: **${report.summary.sitesWithCrossOriginEvidence}**`,
    `- Representative observations persisted into ThirdSight: **${report.summary.observationsPersisted}**`,
    `- Unique persisted cross-origin destination origins: **${report.summary.uniqueCrossOriginOrigins}**`,
    "",
    "This benchmark measures **browser-visible discovery breadth only**. It does not establish merchant Purpose Contracts, backend permissions, server-to-server activity, database access, vendor intent, or downstream vendor behavior.",
    "",
    "## Evidence semantics",
    "",
    "| Question | Public-site answer |",
    "| --- | --- |",
    "| SHOULD | Not provided / UNKNOWN |",
    "| COULD | Partial / browser-visible lower bound |",
    "| DID | Observed request metadata |",
    "| WHY | Not available / UNKNOWN |",
    "| Coverage | Browser only |",
    "| Enforcement | None; no PREVENTED / DETECTED claim from passive homepage discovery |",
    "",
    "## Safety boundary",
    "",
    "- Public pages only, logged out.",
    "- Navigation only; no clicks required for the benchmark.",
    "- No forms submitted, no authentication, no fuzzing, no request mutation.",
    "- No bypass of CAPTCHAs, bot protection, access controls, or rate limits.",
    "- No request bodies, response bodies, cookies, query strings, raw customer payloads, or PII persisted.",
    "- Each site uses an isolated browser context.",
    "",
    "## Category coverage",
    "",
    "| Category | Attempted | Loaded | With evidence | Persisted observations |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...report.categoryStats.map((row) => `| ${row.category} | ${row.attempted} | ${row.loaded} | ${row.withEvidence} | ${row.persisted} |`),
    "",
    "## Most repeated persisted cross-origin destinations",
    "",
    "| Destination origin | Sites | Observations |",
    "| --- | ---: | ---: |",
    ...report.topDestinations.slice(0,20).map((row) => `| ${row.origin.replace(/\|/g,"\\|")} | ${row.siteCount} | ${row.observations} |`),
    "",
    "## Site results",
    "",
    "| Site | Category | HTTP | Loaded | Unique cross-origin origins | Persisted |",
    "| --- | --- | ---: | --- | ---: | ---: |",
    ...report.sites.map((site) => `| ${site.name.replace(/\|/g,"\\|")} | ${site.category} | ${site.responseStatus ?? "-"} | ${site.loadedNormally?"yes":"no"} | ${site.uniqueCrossOriginOrigins.length} | ${site.persistedObservations.length} |`),
    "",
    "## Interpretation",
    "",
    report.thesis,
    "",
    "Failures are retained as benchmark results rather than bypassed. A site that blocks automation or does not load from the runner is reported as unavailable, not silently replaced or forced.",
  ];
  return lines.join("\n") + "\n";
}
