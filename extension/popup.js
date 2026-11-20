const strings = {
  title: "Save to Shannon",
  saving: "Saving this page…",
  saved: "Saved",
  view: "View the review",
  signedOut: "Sign in on Shannon, or paste your save token below.",
  failed: "Could not save this page.",
  cannot: "This page cannot be saved.",
  base: "Shannon address",
  token: "Save token",
  shortcut: "Shortcut: Ctrl+Shift+S. You can also right-click the page.",
};

const baked = String(globalThis.SHANNON_ORIGIN || "").replace(/\/$/, "");
const status = document.querySelector("#status");
const linkRow = document.querySelector("#link-row");
const review = document.querySelector("#review");
const baseRow = document.querySelector("#base-row");
const baseInput = document.querySelector("#base");
const tokenInput = document.querySelector("#token");

document.querySelector("#title").textContent = strings.title;
document.querySelector("#base-label").textContent = strings.base;
document.querySelector("#token-label").textContent = strings.token;
document.querySelector("#shortcut").textContent = strings.shortcut;
review.textContent = strings.view;

function show(result) {
  if (!result) {
    status.textContent = strings.signedOut;
    return;
  }
  status.textContent = result.message || (result.ok ? strings.saved : strings.failed);
  if (result.ok && result.reviewPath && result.baseUrl) {
    review.href = result.baseUrl.replace(/\/$/, "") + result.reviewPath;
    linkRow.hidden = false;
  } else {
    linkRow.hidden = true;
  }
}

async function persist() {
  await chrome.storage.sync.set({
    baseUrl: baked || baseInput.value.trim(),
    token: tokenInput.value.trim(),
  });
}

baseInput.addEventListener("change", persist);
tokenInput.addEventListener("change", persist);

chrome.storage.sync.get({ baseUrl: "", token: "" }).then(async (settings) => {
  const base = baked || settings.baseUrl || "";
  baseInput.value = base;
  tokenInput.value = settings.token || "";
  baseRow.hidden = Boolean(baked);
  if (baked && settings.baseUrl !== baked) {
    await chrome.storage.sync.set({ baseUrl: baked, token: settings.token || "" });
  }
  if (new URLSearchParams(location.search).get("show") === "last") {
    show(await chrome.runtime.sendMessage({ type: "last" }));
    return;
  }
  if (!base) {
    status.textContent = strings.signedOut;
    return;
  }
  status.textContent = strings.saving;
  const result = await chrome.runtime.sendMessage({ type: "save" });
  show(result);
});
