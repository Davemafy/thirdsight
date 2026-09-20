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
  if (message?.type === "THIRDSIGHT_SET_INGESTION_CONFIG") {
    configureIngestion(message.endpoint, message.token)
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
  if (pageUrl && sameOrigin(pageUrl, destinationUrl)) return null;
  if (await isIngestionTransport(destinationUrl)) return null;

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

function sameOrigin(left, right) {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

async function isIngestionTransport(destinationUrl) {
  const config = await chrome.storage.local.get("ingestionEndpoint");
  const endpoint = config.ingestionEndpoint;
  if (typeof endpoint !== "string" || endpoint.length === 0) return false;

  try {
    const configured = new URL(endpoint);
    const destination = new URL(destinationUrl);
    return configured.origin === destination.origin &&
      normalizePath(configured.pathname) === normalizePath(destination.pathname);
  } catch {
    return false;
  }
}

function normalizePath(pathname) {
  if (!pathname) return "/";
  return pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
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

async function storeObservation(observation) {
  const state = await chrome.storage.session.get("browserObservations");
  const current = Array.isArray(state.browserObservations) ? state.browserObservations : [];
  current.unshift(observation);
  await chrome.storage.session.set({
    browserObservations: current.slice(0, MAX_LOCAL_OBSERVATIONS),
  });
}

async function configureIngestion(endpoint, token) {
  if ((endpoint === null || endpoint === "") && (token === null || token === "")) {
    await chrome.storage.local.remove(["ingestionEndpoint", "ingestionToken"]);
    return;
  }

  const parsed = new URL(endpoint);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Ingestion endpoint must use http or https.");
  }

  if (typeof token !== "string" || token.trim().length < 16) {
    throw new Error("Ingestion token must be at least 16 characters.");
  }

  await chrome.storage.local.set({
    ingestionEndpoint: parsed.toString(),
    ingestionToken: token.trim(),
  });
}

async function deliverObservation(observation) {
  const config = await chrome.storage.local.get(["ingestionEndpoint", "ingestionToken"]);
  const endpoint = config.ingestionEndpoint;
  const token = config.ingestionToken;
  if (typeof endpoint !== "string" || endpoint.length === 0) return;
  if (typeof token !== "string" || token.length === 0) return;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
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
