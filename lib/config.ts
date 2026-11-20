/** Server configuration. Keys are read from the environment and never sent to the browser. */

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

export function isLiveModels(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function demoMode(): { auth: "supabase" | "local"; models: "openai" | "canned" } {
  return {
    auth: isSupabaseConfigured() ? "supabase" : "local",
    models: isLiveModels() ? "openai" : "canned",
  };
}

export function itemCallBudget(): number {
  const n = Number(process.env.SHANNON_ITEM_CALL_BUDGET ?? 8);
  if (!Number.isFinite(n) || n < 1) return 8;
  return Math.min(20, Math.floor(n));
}

export function itemUsdBudget(): number {
  const n = Number(process.env.SHANNON_ITEM_BUDGET_USD ?? 0.5);
  if (!Number.isFinite(n) || n <= 0) return 0.5;
  return n;
}

export function modelName(): string {
  const name = process.env.SHANNON_MODEL?.trim();
  return name || "gpt-4.1-mini";
}

export function roleTimeoutMs(): number {
  const n = Number(process.env.SHANNON_ROLE_TIMEOUT_MS ?? 25000);
  if (!Number.isFinite(n) || n < 1000) return 25000;
  return Math.min(n, 60000);
}

const LOOPBACK_HOST = /^(?:0\.0\.0\.0|127\.0\.0\.1|localhost|\[::1\]|::1)(?::\d+)?$/i;

function publicHost(value: string | null): string | null {
  if (!value) return null;
  for (const part of value.split(",")) {
    const host = part.trim();
    if (host && !LOOPBACK_HOST.test(host)) return host;
  }
  return null;
}

/** Browser-facing origin. Never 0.0.0.0. A public Host or X-Forwarded-Host wins; PUBLIC_URL covers a tunnel that rewrites Host to the bind address. */
export function publicOrigin(headerStore: { get(name: string): string | null }): string {
  const forwarded = publicHost(headerStore.get("x-forwarded-host"));
  const host = publicHost(headerStore.get("host"));
  const chosen = forwarded ?? host;
  if (chosen) {
    const proto = headerStore.get("x-forwarded-proto")?.split(",")[0].trim();
    return `${proto === "http" ? "http" : "https"}://${chosen}`;
  }
  const configured = process.env.PUBLIC_URL?.trim().replace(/\/$/, "");
  if (configured) {
    try {
      const url = new URL(configured);
      if (!LOOPBACK_HOST.test(url.host)) return url.origin;
    } catch {
      /* PUBLIC_URL is unset or not a URL */
    }
  }
  const raw = headerStore.get("host")?.split(",")[0].trim() ?? "";
  if (raw && !/^0\.0\.0\.0(?::\d+)?$/i.test(raw)) return `http://${raw}`;
  return "http://127.0.0.1:43123";
}

export function appOrigin(headerStore: { get(name: string): string | null }): string {
  return publicOrigin(headerStore);
}

export function joinOrigin(origin: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
