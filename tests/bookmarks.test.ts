import { mkdtempSync } from "fs";
import path from "path";
import { tmpdir } from "os";
import { afterEach, describe, expect, it } from "vitest";
import { captureAndRun } from "@/lib/shannon/pipeline";
import {
  bookmarkMatches,
  fetchPublicText,
  looksPaywalled,
  normalizeBookmarkUrl,
  pageFavicon,
  pageTitle,
  readArticle,
} from "@/lib/shannon/freeze";
import { SAMPLE_TEXT, SAMPLE_TITLE } from "@/lib/shannon/sample";
import { MemoryStore } from "@/lib/store/memory";
import { metrics } from "@/lib/shannon/core";

const article = `<!doctype html><html><head>
  <title>Bookmark (digital) - Wikipedia</title>
  <link rel="icon" href="/static/favicon/wikipedia.ico">
</head><body>
  <nav><p>Jump to navigation and other chrome that is long enough to look like a paragraph but should be dropped.</p></nav>
  <div class="mw-parser-output">
    <p>A digital bookmark is a saved reference to a web page that a reader expects to open again later.</p>
    <p>The useful part of a bookmark is the address together with the words the reader meant to keep.</p>
    ${Array.from({ length: 45 }, (_, index) => `<p>Paragraph ${index} explains a further detail of saving a page so the library can hold a long article without losing the opening.</p>`).join("")}
  </div></body></html>`;

function store() {
  return new MemoryStore(path.join(mkdtempSync(path.join(tmpdir(), "shannon-bm-")), "store.json"));
}

describe("bookmark capture", () => {
  afterEach(() => {
    delete process.env.SHANNON_TEST_SLOW_ROLE;
    delete process.env.SHANNON_ROLE_TIMEOUT_MS;
  });

  it("normalizes hosts and ignores the hash", () => {
    expect(normalizeBookmarkUrl("https://www.Example.com/wiki/Bookmark/#section")).toBe("https://example.com/wiki/Bookmark");
  });

  it("reads the article, its title, and its icon, and keeps only the opening of a long page", () => {
    const read = readArticle(article);
    expect(read.excerpted).toBe(true);
    expect(read.chunks).toHaveLength(40);
    expect(read.chunks[0]).toMatch(/saved reference/);
    expect(read.chunks.join("\n")).not.toMatch(/Jump to navigation/);
    expect(pageTitle(article)).toBe("Bookmark (digital) - Wikipedia");
    expect(pageFavicon(article, "https://en.wikipedia.org/wiki/Bookmark_(digital)")).toBe(
      "https://en.wikipedia.org/static/favicon/wikipedia.ico",
    );
    expect(looksPaywalled("<p>Subscribe to continue reading this investigation into the budget.</p>")).toBe(true);
  });

  it("searches a saved site by title, address, or page text", () => {
    const source = {
      title: "Bookmark (digital) - Wikipedia",
      url: "https://en.wikipedia.org/wiki/Bookmark_(digital)",
      paragraphs: [{ text: "A digital bookmark is a saved reference to a web page." }],
    };
    expect(bookmarkMatches(source, "wikipedia")).toBe(true);
    expect(bookmarkMatches(source, "en.wikipedia.org/wiki")).toBe(true);
    expect(bookmarkMatches(source, "saved reference")).toBe(true);
    expect(bookmarkMatches(source, "nytimes")).toBe(false);
  });

  it("saves a paste when the site blocks reading, and a second save opens the same item", async () => {
    const memory = store();
    const { userId } = await memory.signUp({ email: "ada@example.com", password: "correct-horse", displayName: "Ada Reader" });
    await memory.confirm((await memory.mailboxFor(userId))[0].token);
    const blocked = await captureAndRun({
      user: { id: userId, displayName: "Ada Reader" },
      store: memory,
      title: "",
      url: "https://www.nytimes.com/locked-story",
      text: SAMPLE_TEXT,
    });
    expect("runId" in blocked).toBe(true);
    if (!("runId" in blocked)) return;
    const saved = (await memory.listSources(userId))[0];
    expect(saved.url).toMatch(/nytimes/);
    expect(saved.origin === "paste" || saved.origin === "url").toBe(true);
    const again = await captureAndRun({
      user: { id: userId, displayName: "Ada Reader" },
      store: memory,
      title: "again",
      url: "https://NYTimes.com/locked-story#top",
      text: "",
    });
    expect(again).toEqual({ runId: blocked.runId });
    expect(await memory.listSources(userId)).toHaveLength(1);
  });

  it("keeps accepted judgments when a bookmark is removed, and hides them from another reader", async () => {
    const memory = store();
    const first = await memory.signUp({ email: "ada@example.com", password: "correct-horse", displayName: "Ada Reader" });
    await memory.confirm((await memory.mailboxFor(first.userId))[0].token);
    const captured = await captureAndRun({
      user: { id: first.userId, displayName: "Ada Reader" },
      store: memory,
      title: SAMPLE_TITLE,
      url: null,
      text: SAMPLE_TEXT,
    });
    if (!("runId" in captured)) throw new Error("expected a run");
    const pending = (await memory.listProposals(first.userId, captured.runId)).filter((item) => item.status === "pending");
    await memory.decide({
      userId: first.userId,
      proposalId: pending[0].proposal_id,
      action: "accept",
      reason: "Keep",
      humanName: "Ada Reader",
    });
    const again = await memory.decide({
      userId: first.userId,
      proposalId: pending[0].proposal_id,
      action: "accept",
      reason: "Keep",
      humanName: "Ada Reader",
    });
    expect(again.status).toBe("accepted");
    expect(await memory.listRegister(first.userId)).toHaveLength(1);
    const quote = pending[0].quote;
    const source = (await memory.listSources(first.userId))[0];
    await memory.deleteSource(first.userId, source.source_id);
    expect(await memory.listSources(first.userId)).toHaveLength(0);
    expect((await memory.searchRegister(first.userId, quote))[0].quote).toBe(quote);
    const other = await memory.signUp({ email: "bea@example.com", password: "correct-horse", displayName: "Bea Reader" });
    expect(await memory.listSources(other.userId)).toHaveLength(0);
    expect(await memory.searchRegister(other.userId, quote)).toHaveLength(0);
    await expect(memory.deleteSource(other.userId, source.source_id)).rejects.toThrow(/library/);
  });

  it("marks the run incomplete when one role times out and keeps the other quotations", async () => {
    process.env.SHANNON_TEST_SLOW_ROLE = "use:economist";
    process.env.SHANNON_ROLE_TIMEOUT_MS = "1000";
    const memory = store();
    const { userId } = await memory.signUp({ email: "ada@example.com", password: "correct-horse", displayName: "Ada Reader" });
    await memory.confirm((await memory.mailboxFor(userId))[0].token);
    const captured = await captureAndRun({
      user: { id: userId, displayName: "Ada Reader" },
      store: memory,
      title: SAMPLE_TITLE,
      url: null,
      text: SAMPLE_TEXT,
    });
    if (!("runId" in captured)) throw new Error("expected a run");
    const run = await memory.getRun(userId, captured.runId);
    expect(run?.status).toBe("incomplete");
    expect(run?.failed_roles.some((role) => role.role_id === "use:economist")).toBe(true);
    const pending = (await memory.listProposals(userId, captured.runId)).filter((item) => item.status === "pending");
    const source = await memory.getSource(userId, run!.source_id);
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((item) => item.role_id !== "use:economist")).toBe(true);
    for (const item of pending) {
      expect(source!.paragraphs.find((paragraph) => paragraph.id === item.paragraph_id)?.text.includes(item.quote)).toBe(true);
    }
    const costs = await memory.listCosts(userId);
    expect(costs.some((event) => event.status === "timeout" && event.estimated_cost_usd === null)).toBe(true);
    expect(costs.some((event) => event.estimated_cost_usd !== null)).toBe(true);
    const report = metrics({
      accepted: 0,
      reviewed: 0,
      eventCosts: costs.map((event) => event.estimated_cost_usd),
    });
    expect(report.cost_per_accepted_judgment_usd).toBeNull();
    expect(report.total_model_cost_usd).toBeNull();
  });
});

describe("one-click save", () => {
  it("keeps text the reader can already see, even when the server would be blocked", async () => {
    const memory = store();
    const signed = await memory.signUp({ email: "click@example.com", password: "correct-horse", displayName: "Click Reader" });
    await memory.confirm((await memory.mailboxFor(signed.userId))[0].token);
    const token = await memory.ensureSaveToken(signed.userId);
    expect(await memory.findUserIdBySaveToken(token)).toBe(signed.userId);
    expect(await memory.findUserIdBySaveToken("nope")).toBeNull();
    const visible = "The reader can see this paragraph on a site that refuses a server fetch. It is long enough to freeze.";
    const saved = await captureAndRun({
      user: { id: signed.userId, displayName: "Click Reader" },
      store: memory,
      title: "Visible article",
      url: "https://www.nytimes.com/locked-story",
      text: visible,
      preferSuppliedText: true,
      favicon: "https://example.com/icon.png",
    });
    expect("runId" in saved).toBe(true);
    const source = (await memory.listSources(signed.userId))[0];
    expect(source.origin).toBe("url");
    expect(source.paragraphs.some((paragraph) => paragraph.text.includes("refuses a server fetch"))).toBe(true);
    expect(source.favicon_url).toBe("https://example.com/icon.png");
  });
});

describe("live pages", () => {
  afterEach(() => {
    delete process.env.SHANNON_TEST_SLOW_ROLE;
    delete process.env.SHANNON_ROLE_TIMEOUT_MS;
  });

  it("refuses a PDF and an invalid address with a paste instruction", async () => {
    await expect(fetchPublicText("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf")).rejects.toThrow(/PDF/);
    await expect(fetchPublicText("not a url")).rejects.toThrow(/web address/);
  });

  it("saves a Wikipedia article, a docs page, and a blog or news page, or explains why not", async () => {
    const pages = [
      "https://en.wikipedia.org/wiki/Bookmark_(digital)",
      "https://developer.mozilla.org/en-US/docs/Web/HTML/Element/p",
      "https://blog.cloudflare.com/",
      "https://www.theguardian.com/world",
    ];
    const memory = store();
    const { userId } = await memory.signUp({ email: "ada@example.com", password: "correct-horse", displayName: "Ada Reader" });
    await memory.confirm((await memory.mailboxFor(userId))[0].token);
    for (const url of pages) {
      const result = await captureAndRun({
        user: { id: userId, displayName: "Ada Reader" },
        store: memory,
        title: "",
        url,
        text: "",
      });
      if ("error" in result) {
        expect(result.error.toLowerCase()).toMatch(/paste|not found|blocked|pdf|web address/);
        continue;
      }
      const source = (await memory.listSources(userId)).find((item) => item.url && item.url.includes(new URL(url).hostname.replace(/^www\./, "")));
      expect(source?.title.length).toBeGreaterThan(0);
      expect(source?.paragraphs.length).toBeGreaterThan(0);
      const run = await memory.getRun(userId, result.runId);
      const pending = (await memory.listProposals(userId, result.runId)).filter((item) => item.status === "pending");
      expect(pending.length).toBeGreaterThan(0);
      expect(pending.length).toBeLessThanOrEqual(8);
      for (const item of pending) {
        expect(source!.paragraphs.find((paragraph) => paragraph.id === item.paragraph_id)?.text.includes(item.quote)).toBe(true);
      }
      expect(run?.status === "complete" || run?.status === "incomplete").toBe(true);
    }
  }, 60000);
});
