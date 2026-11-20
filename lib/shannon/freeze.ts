import { createHash } from "crypto";
import type { Paragraph } from "./types";

const ENTITY: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITY[body] ?? whole;
  });
}

export function collapseSpace(value: string): string {
  return decodeEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost") || host === "0.0.0.0" || host === "::1") {
    return true;
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const octets = ipv4.slice(1).map((part) => Number(part));
  if (octets.some((n) => n > 255)) return true;
  const [a, b] = octets;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

export function coerceUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Identity for "already saved": ignore hash, www, and a trailing slash. */
export function normalizeBookmarkUrl(raw: string): string | null {
  const prepared = coerceUrl(raw);
  if (!prepared) return null;
  let url: URL;
  try {
    url = assertPublicHttpUrl(prepared);
  } catch {
    return null;
  }
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

export function bookmarkMatches(
  source: { title: string; url: string | null; paragraphs: Array<{ text: string }> },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [source.title, source.url ?? "", siteDomain(source.url) ?? "", ...source.paragraphs.map((paragraph) => paragraph.text)]
    .join("\n")
    .toLowerCase();
  return haystack.includes(needle);
}

export function siteDomain(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That doesn't look like a web address. Use a full https link, or paste the passage you want judged.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https links can be captured. Paste the text instead.");
  }
  if (url.username || url.password) {
    throw new Error("Links with embedded credentials are refused. Paste the text instead.");
  }
  if (isPrivateHostname(url.hostname)) {
    throw new Error("Shannon does not read private network addresses. Paste the text instead.");
  }
  return url;
}

const SKIP_PARAGRAPH = /^(jump to|cookie|sign in|subscribe|advertisement|share this|related articles)\b/i;

function contentRegion(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ");
  const wiki = stripped.match(/class="mw-parser-output"/i);
  if (wiki && wiki.index !== undefined) {
    return stripped.slice(wiki.index).split(/id="catlinks"/i)[0];
  }
  const article = stripped.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (article && article[1].length > 400) return article[1];
  const main = stripped.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main && main[1].length > 400) return main[1];
  return stripped
    .replace(/<header\b[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, " ");
}

function collectBlocks(region: string): string[] {
  const blocks: string[] = [];
  const pattern = /<(p|h1|h2|h3|li|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(region))) {
    const text = collapseSpace(match[2].replace(/<[^>]+>/g, " "));
    if (text.length < 40 || SKIP_PARAGRAPH.test(text)) continue;
    blocks.push(text.slice(0, 4000));
  }
  if (blocks.length > 0) return blocks;
  const plain = collapseSpace(region.replace(/<[^>]+>/g, " "));
  return chunkPlain(plain);
}

export function readArticle(html: string): { chunks: string[]; excerpted: boolean } {
  const blocks = collectBlocks(contentRegion(html));
  return { chunks: blocks.slice(0, 40), excerpted: blocks.length > 40 };
}

export function htmlToParagraphs(html: string): string[] {
  return readArticle(html).chunks;
}

export function pageTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const title = collapseSpace(match[1].replace(/<[^>]+>/g, ""));
  return title ? title.slice(0, 180) : null;
}

export function pageFavicon(html: string, pageUrl: string): string | null {
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const ranked = links
    .map((tag) => {
      const rel = (tag.match(/\brel=["']([^"']+)["']/i)?.[1] ?? "").toLowerCase();
      const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
      if (!href || href.startsWith("data:")) return null;
      const score = rel.includes("icon") ? (rel.includes("apple") ? 1 : 2) : 0;
      return score ? { href, score } : null;
    })
    .filter((item): item is { href: string; score: number } => Boolean(item))
    .sort((a, b) => b.score - a.score);
  if (!ranked[0]) return null;
  try {
    return new URL(ranked[0].href, pageUrl).toString();
  } catch {
    return null;
  }
}

export function looksPaywalled(html: string): boolean {
  return /subscribe to continue|to continue reading|sign in to read the full|this article is available to subscribers|you(?:'|’)ve reached your free article/i.test(html);
}

export function splitPasted(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const parts = normalized
    .split(/\n\s*\n/)
    .map((part) => collapseSpace(part))
    .filter((part) => part.length > 0);
  if (parts.length > 1) return parts.slice(0, 40).map((part) => part.slice(0, 4000));
  return chunkPlain(collapseSpace(normalized));
}

function chunkPlain(plain: string): string[] {
  if (plain.length < 40) return plain ? [plain] : [];
  const sentences = plain.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length > 700 && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.slice(0, 40).map((part) => part.slice(0, 4000));
}

export function freezeParagraphs(chunks: string[]): Paragraph[] {
  return chunks
    .map((text) => collapseSpace(text))
    .filter((text) => text.length > 0)
    .slice(0, 40)
    .map((text, index) => ({ id: `p${index + 1}`, text: text.slice(0, 4000) }));
}

export function sourceVersion(paragraphs: Paragraph[]): string {
  const hash = createHash("sha256");
  for (const paragraph of paragraphs) hash.update(paragraph.id + "\n" + paragraph.text + "\n\n");
  return `v1-${hash.digest("hex").slice(0, 12)}`;
}

export function isReadable(paragraphs: Paragraph[]): boolean {
  return paragraphs.some((paragraph) => paragraph.text.trim().length >= 40);
}

export async function fetchPublicText(rawUrl: string): Promise<{ finalUrl: string; body: string }> {
  let current = assertPublicHttpUrl(rawUrl);
  for (let hop = 0; hop < 3; hop += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        "User-Agent": "ShannonPrototype/0.1 (educational source capture)",
        Accept: "text/html, text/plain, application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The page redirected without a destination. Paste the text instead.");
      current = assertPublicHttpUrl(new URL(location, current).toString());
      continue;
    }
    if (response.status === 401 || response.status === 403 || response.status === 451) {
      throw new Error("This site blocked Shannon from reading the page. Paste the passage you want judged.");
    }
    if (response.status === 404) {
      throw new Error("That page was not found. Check the address, or paste the passage you want judged.");
    }
    if (!response.ok) {
      throw new Error(`The page returned ${response.status}. Paste the passage you want judged.`);
    }
    const type = response.headers.get("content-type") ?? "";
    if (/application\/pdf/i.test(type)) {
      throw new Error("That link is a PDF, not a web page. Paste the passage you want judged.");
    }
    if (type && !/text\/html|text\/plain|application\/xhtml\+xml/i.test(type)) {
      throw new Error("That address is not a web page Shannon can read. Paste the passage you want judged.");
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 1_500_000) {
      throw new Error("That page is too large. Paste the passage you care about.");
    }
    const body = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return { finalUrl: current.toString(), body };
  }
  throw new Error("Too many redirects. Paste the text instead.");
}
