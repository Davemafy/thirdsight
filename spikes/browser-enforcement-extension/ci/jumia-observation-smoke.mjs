import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const extensionPath = path.resolve(repoRoot, 'spikes/browser-enforcement-extension');
const reportPath = path.resolve(
  repoRoot,
  process.env.THIRDSIGHT_JUMIA_REPORT ??
    'spikes/browser-enforcement-extension/ci/jumia-observation-report.json',
);

const JUMIA_HOME = 'https://www.jumia.com.ng/';
const JUMIA_CATEGORY = 'https://www.jumia.com.ng/mlp-official-stores/';
const JUMIA_TAB_PATTERN = 'https://www.jumia.com.ng/*';
const OBSERVATION_SETTLE_MS = 6_000;

const report = {
  testedAt: new Date().toISOString(),
  target: 'Jumia Nigeria public logged-out browsing',
  targetUrl: JUMIA_HOME,
  result: 'FAIL',
  browserUserAgent: null,
  extensionId: null,
  finalPageUrl: null,
  httpStatus: null,
  totalObservations: 0,
  firstPartyObservations: 0,
  distinctOrigins: 0,
  topOrigins: [],
  methods: {},
  resourceTypes: {},
  sampleObservations: [],
  notes: [
    'Passive metadata observation only.',
    'No login, checkout, form submission, personal data, request-body persistence, or request modification.',
    'GitHub-hosted runner traffic is not a Nigerian residential IP; the target site is Jumia Nigeria.',
  ],
  error: null,
};

let context;

try {
  const userDataDir = path.join(tmpdir(), `thirdsight-jumia-smoke-${Date.now()}`);

  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  let serviceWorker = context.serviceWorkers()[0];
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', { timeout: 15_000 });
  }

  report.extensionId = new URL(serviceWorker.url()).hostname;

  const page = await context.newPage();
  const response = await page.goto(JUMIA_HOME, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });

  report.httpStatus = response?.status() ?? null;
  report.browserUserAgent = await page.evaluate(() => navigator.userAgent);

  const controlPage = await context.newPage();
  await controlPage.goto(`chrome-extension://${report.extensionId}/ci-control.html`);

  const attachResult = await controlPage.evaluate(
    (urlPattern) =>
      chrome.runtime.sendMessage({
        type: 'THIRDSIGHT_SPIKE_ATTACH_URL',
        urlPattern,
      }),
    JUMIA_TAB_PATTERN,
  );

  if (!attachResult?.ok) {
    throw new Error(`Extension failed to attach to Jumia tab: ${attachResult?.error ?? 'unknown error'}`);
  }

  await page.bringToFront();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(OBSERVATION_SETTLE_MS);

  // A second ordinary public page provides a stronger passive-discovery smoke test
  // without logging in, submitting forms, or triggering checkout/payment flows.
  await page.goto(JUMIA_CATEGORY, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await page.waitForTimeout(OBSERVATION_SETTLE_MS);

  report.finalPageUrl = page.url();

  const stored = await controlPage.evaluate(() =>
    chrome.storage.session.get(['activeTabId', 'attachedAt', 'observations']),
  );

  const observations = Array.isArray(stored.observations) ? stored.observations : [];
  const webObservations = observations.filter(
    (observation) =>
      typeof observation?.origin === 'string' && observation.origin.startsWith('http'),
  );

  report.totalObservations = webObservations.length;
  report.firstPartyObservations = webObservations.filter((observation) => {
    try {
      const hostname = new URL(observation.origin).hostname;
      return hostname === 'jumia.com.ng' || hostname.endsWith('.jumia.com.ng');
    } catch {
      return false;
    }
  }).length;

  const originCounts = countBy(webObservations, (observation) => observation.origin);
  report.distinctOrigins = Object.keys(originCounts).length;
  report.topOrigins = Object.entries(originCounts)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 20)
    .map(([origin, count]) => ({ origin, count }));

  report.methods = countBy(webObservations, (observation) => observation.method ?? 'UNKNOWN');
  report.resourceTypes = countBy(
    webObservations,
    (observation) => observation.resourceType ?? 'Unknown',
  );

  report.sampleObservations = webObservations.slice(0, 25).map((observation) => ({
    observedAt: observation.observedAt,
    method: observation.method,
    origin: observation.origin,
    path: observation.path,
    resourceType: observation.resourceType,
    initiatorType: observation.initiatorType,
    hasPostData: observation.hasPostData,
  }));

  if (report.totalObservations < 5) {
    throw new Error(`Only ${report.totalObservations} browser requests were observed.`);
  }

  if (report.firstPartyObservations < 1) {
    throw new Error('No Jumia first-party browser request was observed after attachment.');
  }

  report.result = 'WORKS';
} catch (error) {
  report.error = error instanceof Error ? error.stack ?? error.message : String(error);
} finally {
  if (context) {
    await context.close().catch(() => undefined);
  }

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

if (report.result !== 'WORKS') {
  process.exitCode = 1;
}

function countBy(values, selector) {
  return values.reduce((counts, value) => {
    const key = selector(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
