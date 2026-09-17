import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const extensionPath = path.resolve(repoRoot, 'spikes/browser-enforcement-extension');
const reportPath = path.resolve(
  repoRoot,
  process.env.THIRDSIGHT_KONGA_REPORT ??
    'spikes/browser-enforcement-extension/ci/konga-observation-report.json',
);

const HOME = 'https://www.konga.com/';
const SECOND_PAGE = 'https://www.konga.com/konganow';
const TAB_PATTERN = 'https://www.konga.com/*';
const SETTLE_MS = 7_000;

const report = {
  testedAt: new Date().toISOString(),
  target: 'Konga Nigeria public logged-out browsing',
  targetUrl: HOME,
  result: 'FAIL',
  browserUserAgent: null,
  extensionId: null,
  initialHttpStatus: null,
  finalPageUrl: null,
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
    'GitHub-hosted runner traffic is not a Nigerian residential IP; the target site is Konga Nigeria.',
  ],
  error: null,
};

let context;

try {
  const userDataDir = path.join(tmpdir(), `thirdsight-konga-smoke-${Date.now()}`);

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
  const response = await page.goto(HOME, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  report.initialHttpStatus = response?.status() ?? null;
  report.browserUserAgent = await page.evaluate(() => navigator.userAgent);

  const controlPage = await context.newPage();
  await controlPage.goto(`chrome-extension://${report.extensionId}/ci-control.html`);

  const attachResult = await controlPage.evaluate(
    (urlPattern) =>
      chrome.runtime.sendMessage({
        type: 'THIRDSIGHT_SPIKE_ATTACH_URL',
        urlPattern,
      }),
    TAB_PATTERN,
  );

  if (!attachResult?.ok) {
    throw new Error(`Extension failed to attach to Konga tab: ${attachResult?.error ?? 'unknown error'}`);
  }

  await page.bringToFront();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(SETTLE_MS);

  await page.goto(SECOND_PAGE, {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await page.waitForTimeout(SETTLE_MS);

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
      return hostname === 'konga.com' || hostname.endsWith('.konga.com');
    } catch {
      return false;
    }
  }).length;

  const originCounts = countBy(webObservations, (observation) => observation.origin);
  report.distinctOrigins = Object.keys(originCounts).length;
  report.topOrigins = Object.entries(originCounts)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 25)
    .map(([origin, count]) => ({ origin, count }));

  report.methods = countBy(webObservations, (observation) => observation.method ?? 'UNKNOWN');
  report.resourceTypes = countBy(
    webObservations,
    (observation) => observation.resourceType ?? 'Unknown',
  );

  report.sampleObservations = webObservations.slice(0, 30).map((observation) => ({
    observedAt: observation.observedAt,
    method: observation.method,
    origin: observation.origin,
    path: observation.path,
    resourceType: observation.resourceType,
    initiatorType: observation.initiatorType,
    hasPostData: observation.hasPostData,
  }));

  if (report.totalObservations < 10) {
    throw new Error(`Only ${report.totalObservations} browser requests were observed.`);
  }

  if (report.firstPartyObservations < 1) {
    throw new Error('No Konga first-party browser request was observed after attachment.');
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
