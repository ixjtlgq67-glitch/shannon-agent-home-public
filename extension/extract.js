globalThis.shannonExtract = function shannonExtract() {
  const selected = window.getSelection ? String(window.getSelection()) : "";
  if (selected && selected.trim().length >= 40) {
    return { text: selected.trim().slice(0, 80000) };
  }
  const root =
    document.querySelector("article") ||
    document.querySelector("main") ||
    document.querySelector("[role='main']") ||
    document.querySelector(".mw-parser-output") ||
    document.body;
  const clone = root.cloneNode(true);
  clone.querySelectorAll("script, style, noscript, svg, nav, footer, form").forEach((node) => node.remove());
  const text = (clone.innerText || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { text: text.slice(0, 80000) };
};
