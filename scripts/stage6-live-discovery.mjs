import { chromium } from "playwright";
import fs from "node:fs/promises";

const base = process.env.THIRDSIGHT_URL ?? "https://thirdsight-five.vercel.app";
const token = process.env.THIRDSIGHT_OIDC_TOKEN;
if (!token) throw new Error("THIRDSIGHT_OIDC_TOKEN is required.");

const extensionPath = new URL("../browser-extension/", import.meta.url).pathname;
const context = await chromium.launchPersistentContext("", {
  headless: false,
  viewport: { width: 1440, height: 1100 },
  args: [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
  ],
});

try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  const page = await context.newPage();

  const initial = await page.goto("https://www.konga.com/konganow", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const status = initial?.status() ?? 0;
  if (status < 200 || status >= 400) {
    throw new Error(`Public commerce page did not load normally (HTTP ${status}); no bypass attempted.`);
  }

  await worker.evaluate(async ({ endpoint, tokenValue }) => {
    await chrome.storage.local.set({
      ingestionEndpoint: endpoint,
      ingestionToken: tokenValue,
    });
  }, { endpoint: `${base}/api/browser-observations`, tokenValue: token });

  const tabId = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    const target = tabs.find((tab) => tab.url?.startsWith("https://www.konga.com/"));
    return target?.id ?? null;
  });
  if (!tabId) throw new Error("Could not resolve the logged-out Konga tab.");

  await worker.evaluate(async (id) => {
    const target = { tabId: id };
    const targets = await chrome.debugger.getTargets();
    const alreadyAttached = targets.some((item) => item.tabId === id && item.attached);
    if (!alreadyAttached) await chrome.debugger.attach(target, "1.3");
    await chrome.debugger.sendCommand(target, "Network.enable");
  }, tabId);

  const reload = await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
  const reloadStatus = reload?.status() ?? 0;
  if (reloadStatus < 200 || reloadStatus >= 400) {
    throw new Error(`Observed page reload did not load normally (HTTP ${reloadStatus}); no bypass attempted.`);
  }

  await page.waitForTimeout(12_000);

  const state = await worker.evaluate(async () => {
    return await chrome.storage.session.get(["browserObservations", "lastIngestion"]);
  });
  const observations = Array.isArray(state.browserObservations) ? state.browserObservations : [];
  if (observations.length === 0) throw new Error("Extension captured no browser observations.");
  if (!state.lastIngestion?.ok) {
    throw new Error(`Extension did not persist its last observation: ${JSON.stringify(state.lastIngestion)}`);
  }

  const crossOrigin = observations.find((item) => {
    try {
      const pageOrigin = item.pageUrl ? new URL(item.pageUrl).origin : null;
      return pageOrigin && new URL(item.destinationUrl).origin !== pageOrigin;
    } catch {
      return false;
    }
  });
  if (!crossOrigin) throw new Error("No browser-visible cross-origin observation was captured.");

  if (crossOrigin.destinationUrl.includes("?") || crossOrigin.pageUrl?.includes("?")) {
    throw new Error("Sanitized discovery observation retained a query string.");
  }

  const targetRecordId = `browser:${crossOrigin.sensorId}:${crossOrigin.observationId}`;
  let evidence = null;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${base}/api/console-events`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Console API returned ${response.status}.`);
    const body = await response.json();
    evidence = body.history?.find((item) => item.recordId === targetRecordId) ?? null;
    if (evidence) break;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  if (!evidence) throw new Error("Exact extension observation did not reach the durable evidence console.");

  const expected = [
    [evidence.should?.status, "UNKNOWN", "SHOULD"],
    [evidence.could?.status, "PARTIAL", "COULD"],
    [evidence.did?.status, "KNOWN", "DID"],
    [evidence.did?.confidence, "OBSERVED", "DID confidence"],
    [evidence.why?.status, "UNKNOWN", "WHY"],
    [evidence.coverage?.label, "BROWSER_ONLY", "coverage"],
  ];
  for (const [actual, wanted, label] of expected) {
    if (actual !== wanted) throw new Error(`${label} expected ${wanted}, received ${actual}`);
  }
  if (evidence.outcome !== null) throw new Error("Discovery-only public-site evidence must not claim PREVENTED or DETECTED.");
  if (evidence.integrationId !== null) throw new Error("Public-site discovery unexpectedly inferred merchant integration identity.");
  if (evidence.did.value?.originRelationship !== "CROSS_ORIGIN") throw new Error("Selected evidence is not a cross-origin browser observation.");

  await page.goto(base, { waitUntil: "networkidle", timeout: 60_000 });
  let selected = false;
  const buttons = page.locator("nav button");
  const count = await buttons.count();
  for (let index = 0; index < count; index += 1) {
    await buttons.nth(index).click();
    const recordId = await page.locator(".event-head small").innerText().catch(() => "");
    if (recordId.trim() === targetRecordId) { selected = true; break; }
  }
  if (!selected) throw new Error("Persisted discovery record was not selectable in the deployed console.");

  const mainText = (await page.locator("main").innerText()).toLowerCase();
  for (const tokenText of [
    "should?", "not provided", "could?", "partial / browser-visible",
    "did?", "observed", "why?", "not available", "coverage",
    "browser only", "discovery only", "no merchant purpose contract",
  ]) {
    if (!mainText.includes(tokenText)) throw new Error(`Console missing discovery limit: ${tokenText}`);
  }
  if (mainText.includes("prevented")) throw new Error("Discovery console incorrectly claims PREVENTED.");

  await page.screenshot({ path: "stage6-real-site-discovery.png", fullPage: true });

  const proof = {
    verified: true,
    site: "Konga Nigeria",
    mode: "public logged-out passive discovery",
    pageStatus: reloadStatus,
    recordId: targetRecordId,
    pageOrigin: evidence.did.value?.pageOrigin,
    destinationOrigin: evidence.did.value?.destinationOrigin,
    destinationPath: evidence.did.value?.destinationPath,
    method: evidence.did.value?.method,
    resourceType: evidence.did.value?.resourceType,
    originRelationship: evidence.did.value?.originRelationship,
    should: "Not provided",
    could: "Partial / browser-visible",
    did: "Observed",
    why: "Not available",
    coverage: "Browser only",
    outcome: null,
    integrationResolution: evidence.integrationResolution,
    observationsCapturedLocally: observations.length,
    privacy: {
      requestBodiesPersisted: false,
      queryStringsPersisted: false,
      requestModification: false,
      loginUsed: false,
    },
  };
  await fs.writeFile("stage6-real-site-discovery.json", JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof));
} finally {
  await context.close();
}
