const DEBUGGER_PROTOCOL_VERSION = '0.1';
const ANALYTICS_INTERCEPT_PATTERN = '*://*/api/spike/analytics*';
const MAX_OBSERVATIONS = 100;

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith('http')) {
    console.warn('[ThirdSight spike] Open an http(s) page before attaching.');
    return;
  }

  const target = { tabId: tab.id };
  const targets = await chrome.debugger.getTargets();
  const isAttached = targets.some(
    (candidate) => candidate.tabId === tab.id && candidate.attached,
  );

  if (isAttached) {
    await chrome.debugger.detach(target);
    await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
    console.info('[ThirdSight spike] Detached from tab', tab.id);
    return;
  }

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
});

chrome.debugger.onDetach.addListener(async (source, reason) => {
  if (!source.tabId) return;
  await chrome.action.setBadgeText({ tabId: source.tabId, text: '' });
  console.info('[ThirdSight spike] Debugger detached', { tabId: source.tabId, reason });
});

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  if (!source.tabId || !params) return;

  if (method === 'Network.requestWillBeSent') {
    await recordObservation(source.tabId, params);
    return;
  }

  if (method === 'Fetch.requestPaused') {
    await handlePausedRequest(source, params);
  }
});

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

async function handlePausedRequest(source, params) {
  const requestId = params.requestId;
  const request = params.request;

  if (!request?.url?.includes('/api/spike/analytics')) {
    await continueRequest(source, requestId);
    return;
  }

  const postData = request.postData;
  if (!postData) {
    await continueRequest(source, requestId);
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

    await chrome.debugger.sendCommand(source, 'Fetch.continueRequest', {
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
    await continueRequest(source, requestId);
  }
}

async function continueRequest(source, requestId) {
  await chrome.debugger.sendCommand(source, 'Fetch.continueRequest', { requestId });
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
