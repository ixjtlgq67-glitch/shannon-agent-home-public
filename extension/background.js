importScripts("defaults.js");

const MENU_ID = "save-to-shannon";

const text = {
  menu: "Save to Shannon",
  saved: "Saved",
  duplicate: "Already in your library",
  failed: "Could not save this page",
  signedOut: "Sign in on Shannon, or add your save token",
  cannot: "This page cannot be saved",
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: text.menu,
      contexts: ["page", "selection"],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_ID) saveActiveTab();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "save-page") saveActiveTab();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === "save") {
    saveActiveTab().then(sendResponse);
    return true;
  }
  if (message && message.type === "last") {
    chrome.storage.local.get("lastSave").then((stored) => sendResponse(stored.lastSave || null));
    return true;
  }
  return false;
});

async function saveActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !tab.url || /^(chrome|edge|about|chrome-extension|devtools):/i.test(tab.url)) {
    return remember({ ok: false, code: "cannot", message: text.cannot });
  }
  let pageText = "";
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["extract.js"] });
    const [injected] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.shannonExtract(),
    });
    pageText = injected && injected.result ? injected.result.text : "";
  } catch {
    pageText = "";
  }
  const settings = await chrome.storage.sync.get({ baseUrl: "", token: "" });
  const baked = String(globalThis.SHANNON_ORIGIN || "").replace(/\/$/, "");
  const base = baked || String(settings.baseUrl || "").replace(/\/$/, "");
  if (!base) return remember({ ok: false, code: "unauthorized", message: text.signedOut });
  try {
    const response = await fetch(`${base}/api/save`, {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(settings.token ? { authorization: `Bearer ${settings.token}` } : {}),
      },
      body: JSON.stringify({
        url: tab.url,
        title: tab.title || "",
        favicon: tab.favIconUrl || "",
        text: pageText,
      }),
    });
    const payload = await response.json().catch(() => ({ ok: false, code: "failed" }));
    const result = {
      ok: Boolean(payload.ok),
      code: payload.code || (response.status === 401 ? "unauthorized" : "failed"),
      reviewPath: payload.reviewPath || "",
      baseUrl: base,
      message: text.failed,
    };
    if (result.ok) result.message = text.saved;
    if (result.code === "duplicate") result.message = text.duplicate;
    if (result.code === "unauthorized") result.message = text.signedOut;
    if (!result.ok && payload.message && result.code !== "unauthorized") result.message = payload.message;
    await remember(result);
    chrome.action.setBadgeText({ text: result.ok ? "OK" : "!" });
    try {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: text.menu,
        message: result.message,
      });
    } catch {
      /* notification permission can be denied */
    }
    return result;
  } catch (error) {
    return remember({ ok: false, code: "failed", message: error instanceof Error ? error.message : text.failed });
  }
}

function remember(result) {
  return chrome.storage.local.set({ lastSave: result }).then(() => result);
}

globalThis.saveActiveTab = saveActiveTab;
