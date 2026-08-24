const ICONS = {
  ipv4: "icons/ipv4.svg",
  ipv6: "icons/ipv6.svg",
  unknown: "icons/unknown.svg",
};

const connections = new Map();

function familyOf(ip) {
  if (!ip) return "unknown";
  return ip.includes(":") ? "ipv6" : "ipv4";
}

function hostOf(url) {
  try {
    const host = new URL(url).hostname;
    return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
  } catch (e) {
    return "";
  }
}

function isIpLiteral(host) {
  return /^[0-9.]+$/.test(host) || host.includes(":");
}

async function isActiveTab(tabId) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return Boolean(tab && tab.id === tabId);
}

async function paint(tabId) {
  const record = connections.get(tabId);
  const family = record ? familyOf(record.ip) : "unknown";
  const icon = ICONS[family];
  const path = { 32: icon, 64: icon };
  const familyLabel = family === "ipv6" ? "IPv6" : "IPv4";
  // Firefox for Android renders this as the menu entry's label, so keep it to
  // one line that starts with the part worth reading when truncated.
  const title = record && record.ip ? `${familyLabel} · ${record.ip}` : "IP Indicator";

  const badge = family === "unknown" ? "" : family === "ipv6" ? "6" : "4";
  const badgeColor = family === "ipv6" ? "#4f46e5" : family === "ipv4" ? "#059669" : "#4b5563";

  try {
    await browser.browserAction.setIcon({ tabId, path });
    await browser.browserAction.setTitle({ tabId, title });
    await browser.browserAction.setBadgeText({ tabId, text: badge });
    await browser.browserAction.setBadgeBackgroundColor({ tabId, color: badgeColor });
    // Firefox for Android draws the browser menu entry from the default icon
    // and badge rather than the per-tab ones, so mirror them for the tab in front.
    if (await isActiveTab(tabId)) {
      await browser.browserAction.setIcon({ path });
      await browser.browserAction.setBadgeText({ text: badge });
      await browser.browserAction.setBadgeBackgroundColor({ color: badgeColor });
    }
  } catch (e) {
    connections.delete(tabId);
  }
}

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;
    connections.set(details.tabId, { host: hostOf(details.url), ip: null, fromCache: false });
    paint(details.tabId);
  },
  { urls: ["<all_urls>"], types: ["main_frame"] }
);

browser.webRequest.onResponseStarted.addListener(
  (details) => {
    if (details.tabId < 0) return;
    connections.set(details.tabId, {
      host: hostOf(details.url),
      ip: details.ip || null,
      fromCache: Boolean(details.fromCache),
    });
    paint(details.tabId);
  },
  { urls: ["<all_urls>"], types: ["main_frame"] }
);

browser.tabs.onRemoved.addListener((tabId) => connections.delete(tabId));

browser.tabs.onActivated.addListener(({ tabId }) => paint(tabId));

async function lookup(host) {
  const result = { v4: [], v6: [], canonicalName: null, isTRR: null, error: null };
  if (!host || isIpLiteral(host)) return result;

  const [v4, v6] = await Promise.all([
    browser.dns.resolve(host, ["disable_ipv6", "canonical_name"]).catch((e) => e),
    browser.dns.resolve(host, ["disable_ipv4"]).catch((e) => e),
  ]);

  if (v4 instanceof Error) {
    result.error = v4.message;
  } else {
    result.v4 = v4.addresses || [];
    result.canonicalName = v4.canonicalName || null;
    result.isTRR = v4.isTRR;
  }

  if (v6 instanceof Error) {
    if (!result.v4.length && !result.error) result.error = v6.message;
  } else {
    result.v6 = v6.addresses || [];
    if (result.isTRR === null) result.isTRR = v6.isTRR;
  }

  return result;
}

async function describeActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) return { error: "No active tab." };

  const host = hostOf(tab.url);
  if (!host) return { url: tab.url, error: "This page has no domain to resolve." };

  const record = connections.get(tab.id);
  const connectionIp = record && record.host === host ? record.ip : null;
  const dns = await lookup(host);

  let ip = connectionIp;
  let source = "connection";
  if (!ip) {
    ip = isIpLiteral(host) ? host : dns.v6[0] || dns.v4[0] || null;
    source = isIpLiteral(host) ? "literal" : "dns";
  }

  return {
    host,
    url: tab.url,
    ip,
    source,
    family: familyOf(ip),
    fromCache: Boolean(record && record.fromCache),
    dns,
  };
}

browser.runtime.onMessage.addListener((message) => {
  if (message && message.type === "getInfo") return describeActiveTab();
});
