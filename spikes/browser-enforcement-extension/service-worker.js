const DEBUGGER_PROTOCOL_VERSION = '1.3';
const ANALYTICS_INTERCEPT_PATTERN = '*://*/api/spike/analytics*';
const MAX_OBSERVATIONS = 100;

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith('http')) {
    console.warn('[ThirdSight spike] Open an http(s) page before attaching.');
    return;
  }

  try {
    const isAttached = await isDebuggerAttached(tab.id);
    if (isAttached) {
      await detachTab(tab.id);
      return;
    }

    await attachTab(tab);
  } catch (error) {
    console.error('[ThirdSight spike] Could not toggle attachment.', error);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'THIRDSIGHT_SPIKE_ATTACH_URL') return false;

  attachFirstMatchingTab(message.urlPattern)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  return true;
});

chrome.debugger.onDetach.addListener(async (source, reason) => {
  if (!source.tabId) return;
  await chrome.action.setBadgeText({ tabId: source.tabId, text: '' });
  console.info('[ThirdSight spike] Debugger detached', { tabId: source.tabId, reason });
});

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  if (!source.tabId || !params) return;

  try {
    if (method === 'Network.requestWillBeSent') {
      await recordObservation(source.tabId, params);
      return;
    }

    if (method === 'Fetch.requestPaused') {
      await handlePausedRequest(source.tabId, params);
    }
  } catch (error) {
    console.error('[ThirdSight spike] Debugger event handler failed.', {
      method,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

async function attachFirstMatchingTab(urlPattern) {
  if (typeof urlPattern !== 'string' || !urlPattern.startsWith('http')) {
    throw new Error('A concrete http(s) URL pattern is required.');
  }

  const tabs = await chrome.tabs.query({ url: urlPattern });
  const tab = tabs.find((candidate) => candidate.id && candidate.url?.startsWith('http'));

  if (!tab?.id) {
    throw new Error(`No matching browser tab found for ${urlPattern}`);
  }

  // CI drives Chromium through a separate automation client, so getTargets().attached
  // may already be true even when this extension has not attached. The CI control path
  // must therefore attempt the extension attachment explicitly and let Chrome decide
  // whether concurrent debugger clients are supported.
  await attachTab(tab);

  return { tabId: tab.id, url: tab.url };
}

async function isDebuggerAttached(tabId) {
  const targets = await chrome.debugger.getTargets();
  return targets.some((candidate) => candidate.tabId === tabId && candidate.attached);
}

async function attachTab(tab) {
  if (!tab.id || !tab.url?.startsWith('http')) {
    throw new Error('Cannot attach to a non-http(s) tab.');
  }

  const target = { tabId: tab.id };

  await chrome.debugger.attach(target, DEBUGGER_PROTOCOL_VERSION);
  await chrome.debugger.sendCommand(target, 'Network.enable');
  await chrome.debugger.sendCommand(target, 'Fetch.enable', {
    patterns: [
      {
        urlPattern: ANALYTICS_INTERCEPT_PATTERN,
        requestStage: 'Request',
      },
    ],
  });

  await chrome.storage.session.set({
    activeTabId: tab.id,
    attachedAt: new Date().toISOString(),
    lastEnforcement: null,
    observations: [],
  });

  await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#155EEF' });
  await chrome.action.setBadgeText({ tabId: tab.id, text: 'ON' });

  console.info('[ThirdSight spike] Attached to tab', tab.id, tab.url);
}

async function detachTab(tabId) {
  const target = { tabId };
  await chrome.debugger.detach(target);
  await chrome.action.setBadgeText({ tabId, text: '' });
  console.info('[ThirdSight spike] Detached from tab', tabId);
}

async function recordObservation(tabId, params) {
  const request = params.request;
  if (!request?.url?.startsWith('http')) return;

  let parsedUrl;
  try {
    parsedUrl = new URL(request.url);
  } catch {
    return;
  }

  const observation = {
    observedAt: new Date().toISOString(),
    tabId,
    method: request.method,
    origin: parsedUrl.origin,
    path: parsedUrl.pathname,
    resourceType: params.type ?? 'Other',
    initiatorType: params.initiator?.type ?? 'unknown',
    hasPostData: Boolean(request.hasPostData || request.postData),
  };

  const current = await chrome.storage.session.get('observations');
  const observations = Array.isArray(current.observations)
    ? current.observations
    : [];

  observations.unshift(observation);
  await chrome.storage.session.set({
    observations: observations.slice(0, MAX_OBSERVATIONS),
  });

  console.info('[ThirdSight observe]', observation);
}

async function handlePausedRequest(tabId, params) {
  const target = { tabId };
  const requestId = params.requestId;
  const request = params.request;

  if (!request?.url?.includes('/api/spike/analytics')) {
    await continueRequest(target, requestId);
    return;
  }

  const postData = request.postData;
  if (!postData) {
    await continueRequest(target, requestId);
    return;
  }

  try {
    const payload = JSON.parse(postData);
    const beforeFields = collectFieldPaths(payload);
    const removed = [];

    if (
      payload &&
      typeof payload === 'object' &&
      payload.customer &&
      typeof payload.customer === 'object' &&
      Object.prototype.hasOwnProperty.call(payload.customer, 'phone')
    ) {
      delete payload.customer.phone;
      removed.push('customer.phone');

      if (Object.keys(payload.customer).length === 0) {
        delete payload.customer;
      }
    }

    const afterFields = collectFieldPaths(payload);
    const modifiedPostData = JSON.stringify(payload);

    await chrome.debugger.sendCommand(target, 'Fetch.continueRequest', {
      requestId,
      postData: encodeBase64Utf8(modifiedPostData),
    });

    const enforcement = {
      enforcedAt: new Date().toISOString(),
      requestUrl: request.url,
      method: request.method,
      beforeFields,
      afterFields,
      removed,
      outcome: removed.length > 0 ? 'PREVENTED' : 'UNCHANGED',
    };

    await chrome.storage.session.set({ lastEnforcement: enforcement });
    console.info('[ThirdSight enforce]', enforcement);
  } catch (error) {
    console.error('[ThirdSight spike] Could not rewrite request; continuing unchanged.', error);
    await continueRequest(target, requestId);
  }
}

async function continueRequest(target, requestId) {
  await chrome.debugger.sendCommand(target, 'Fetch.continueRequest', { requestId });
}

function collectFieldPaths(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      const nested = collectFieldPaths(child, path);
      return nested.length > 0 ? nested : [path];
    }
    return [path];
  });
}

function encodeBase64Utf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
