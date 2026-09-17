const DEBUGGER_PROTOCOL_VERSION = "1.3";
const MAX_LOCAL_OBSERVATIONS = 100;
const SENSOR_PREFIX = "browser-extension";

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.startsWith("http")) return;

  const targets = await chrome.debugger.getTargets();
  const attached = targets.some((target) => target.tabId === tab.id && target.attached);

  if (attached) {
    await chrome.debugger.detach({ tabId: tab.id });
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    return;
  }

  await attach(tab.id);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "THIRDSIGHT_SET_INGESTION_ENDPOINT") {
    configureEndpoint(message.endpoint)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "THIRDSIGHT_ATTACH_TAB" && Number.isInteger(message.tabId)) {
    attach(message.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  return false;
});

chrome.debugger.onDetach.addListener(async (source) => {
  if (source.tabId) await chrome.action.setBadgeText({ tabId: source.tabId, text: "" });
});

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  if (!source.tabId || method !== "Network.requestWillBeSent" || !params?.request?.url) return;

  const observation = await buildObservation(source.tabId, params);
  if (!observation) return;

  await storeObservation(observation);
  await deliverObservation(observation);
});

async function attach(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url?.startsWith("http")) throw new Error("ThirdSight can only attach to http(s) tabs.");

  const target = { tabId };
  await chrome.debugger.attach(target, DEBUGGER_PROTOCOL_VERSION);
  await chrome.debugger.sendCommand(target, "Network.enable");
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#155EEF" });
  await chrome.action.setBadgeText({ tabId, text: "ON" });
}

async function buildObservation(tabId, params) {
  const destinationUrl = sanitizeHttpUrl(params.request.url);
  if (!destinationUrl) return null;

  const tab = await chrome.tabs.get(tabId);
  const pageUrl = sanitizeHttpUrl(tab.url ?? "");
  const observedAt = new Date().toISOString();

  return {
    schemaVersion: "browser-observation.v1",
    observationId: crypto.randomUUID(),
    sensorId: `${SENSOR_PREFIX}:tab-${tabId}`,
    observedAt,
    pageUrl,
    destinationUrl,
    method: params.request.method ?? "GET",
    resourceType: params.type ?? "Other",
    initiatorType: params.initiator?.type ?? "unknown",
    hasPostData: Boolean(params.request.hasPostData || params.request.postData),
  };
}

function sanitizeHttpUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

async function storeObservation(observation) {
  const state = await chrome.storage.session.get("browserObservations");
  const current = Array.isArray(state.browserObservations) ? state.browserObservations : [];
  current.unshift(observation);
  await chrome.storage.session.set({
    browserObservations: current.slice(0, MAX_LOCAL_OBSERVATIONS),
  });
}

async function configureEndpoint(endpoint) {
  if (endpoint === null || endpoint === "") {
    await chrome.storage.local.remove("ingestionEndpoint");
    return;
  }

  const parsed = new URL(endpoint);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Ingestion endpoint must use http or https.");
  }

  await chrome.storage.local.set({ ingestionEndpoint: parsed.toString() });
}

async function deliverObservation(observation) {
  const config = await chrome.storage.local.get("ingestionEndpoint");
  const endpoint = config.ingestionEndpoint;
  if (typeof endpoint !== "string" || endpoint.length === 0) return;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(observation),
      credentials: "omit",
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);
    await chrome.storage.session.set({
      lastIngestion: {
        observationId: observation.observationId,
        at: new Date().toISOString(),
        ok: response.ok,
        status: response.status,
        result,
      },
    });
  } catch (error) {
    await chrome.storage.session.set({
      lastIngestion: {
        observationId: observation.observationId,
        at: new Date().toISOString(),
        ok: false,
        status: null,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
