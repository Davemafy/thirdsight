import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const extensionPath = path.resolve(repoRoot, 'spikes/browser-enforcement-extension');
const reportPath = path.resolve(
  repoRoot,
  process.env.THIRDSIGHT_SPIKE_REPORT ?? 'spikes/browser-enforcement-extension/ci/report.json',
);
const merchantUrl = 'http://127.0.0.1:3000/spike/browser-enforcement';
const merchantPattern = `${merchantUrl}*`;

const report = {
  testedAt: new Date().toISOString(),
  observation: 'FAIL',
  enforcement: 'FAIL',
  browserUserAgent: null,
  extensionId: null,
  receiver: null,
  evidence: null,
  extensionLogs: [],
  error: null,
};

let context;
let controlPage;

try {
  const userDataDir = path.join(tmpdir(), `thirdsight-browser-spike-${Date.now()}`);

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

  serviceWorker.on('console', (message) => {
    const entry = { type: message.type(), text: message.text() };
    report.extensionLogs.push(entry);
    console.log(`[extension:${entry.type}] ${entry.text}`);
  });

  const workerUrl = new URL(serviceWorker.url());
  report.extensionId = workerUrl.hostname;

  const merchantPage = await context.newPage();
  await merchantPage.goto(merchantUrl, { waitUntil: 'domcontentloaded' });
  report.browserUserAgent = await merchantPage.evaluate(() => navigator.userAgent);

  controlPage = await context.newPage();
  await controlPage.goto(`chrome-extension://${report.extensionId}/ci-control.html`);

  const attachResult = await controlPage.evaluate(
    (urlPattern) => chrome.runtime.sendMessage({
      type: 'THIRDSIGHT_SPIKE_ATTACH_URL',
      urlPattern,
    }),
    merchantPattern,
  );

  console.log('Attach result:', JSON.stringify(attachResult));

  if (!attachResult?.ok) {
    throw new Error(`Extension failed to attach: ${attachResult?.error ?? 'unknown error'}`);
  }

  await merchantPage.bringToFront();
  await merchantPage.getByRole('button', { name: 'Send attempted analytics event' }).click();
  await merchantPage.waitForFunction(
    () => document.body.innerText.includes('NO — field was prevented'),
    null,
    { timeout: 12_000 },
  );

  const receiverText = await merchantPage.locator('section pre').textContent();
  if (!receiverText) {
    throw new Error('Receiver result was not rendered.');
  }

  const receiver = JSON.parse(receiverText);
  report.receiver = receiver;

  if (receiver.phoneReceived !== false) {
    throw new Error('Receiver still received customer.phone.');
  }

  if (receiver.receivedFields.includes('customer.phone')) {
    throw new Error('Receiver field list still includes customer.phone.');
  }

  const evidence = await waitForEvidence(controlPage);
  report.evidence = evidence;

  const enforcement = evidence.lastEnforcement;
  if (!enforcement) {
    throw new Error('No enforcement evidence was recorded.');
  }

  const enforcementPassed =
    enforcement.outcome === 'PREVENTED' &&
    enforcement.beforeFields.includes('customer.phone') &&
    !enforcement.afterFields.includes('customer.phone') &&
    enforcement.removed.includes('customer.phone');

  if (!enforcementPassed) {
    throw new Error('Enforcement evidence does not prove customer.phone was removed pre-send.');
  }

  report.enforcement = 'WORKS';

  const observedAnalyticsRequest = evidence.observations.some(
    (observation) =>
      observation.method === 'POST' &&
      observation.path === '/api/spike/analytics' &&
      observation.hasPostData === true,
  );

  if (!observedAnalyticsRequest) {
    throw new Error('Network observation did not record the analytics POST.');
  }

  report.observation = 'WORKS';
} catch (error) {
  report.error = error instanceof Error ? error.stack ?? error.message : String(error);

  if (controlPage) {
    try {
      const diagnosticEvidence = await controlPage.evaluate(() => chrome.storage.session.get(null));
      report.evidence = diagnosticEvidence;
      console.log('Diagnostic storage:', JSON.stringify(diagnosticEvidence, null, 2));
    } catch (diagnosticError) {
      report.extensionLogs.push({
        type: 'diagnostic-error',
        text: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError),
      });
    }
  }
} finally {
  if (context) {
    await context.close().catch(() => undefined);
  }

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify(report, null, 2));
}

if (report.observation !== 'WORKS' || report.enforcement !== 'WORKS') {
  process.exitCode = 1;
}

async function waitForEvidence(page) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const evidence = await page.evaluate(() =>
      chrome.storage.session.get(['lastEnforcement', 'observations']),
    );

    const observations = Array.isArray(evidence.observations) ? evidence.observations : [];
    const hasAnalyticsObservation = observations.some(
      (observation) =>
        observation.method === 'POST' && observation.path === '/api/spike/analytics',
    );

    if (evidence.lastEnforcement && hasAnalyticsObservation) {
      return {
        lastEnforcement: evidence.lastEnforcement,
        observations,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return page.evaluate(async () => {
    const evidence = await chrome.storage.session.get(['lastEnforcement', 'observations']);
    return {
      lastEnforcement: evidence.lastEnforcement ?? null,
      observations: Array.isArray(evidence.observations) ? evidence.observations : [],
    };
  });
}
