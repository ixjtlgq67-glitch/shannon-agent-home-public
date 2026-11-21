/** Whether this Supabase project allows anonymous sign-in. Cached briefly so a dashboard change is picked up without a restart. */

type Cache = { at: number; enabled: boolean };

const globalCache = globalThis as unknown as { __shannonAnon?: Cache };

export function anonymousFromSettings(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const external = (body as { external?: { anonymous_users?: boolean } }).external;
  return Boolean(external?.anonymous_users);
}

export async function anonymousAuthEnabled(): Promise<boolean> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  const now = Date.now();
  const cached = globalCache.__shannonAnon;
  if (cached && now - cached.at < 15000) return cached.enabled;
  let enabled = false;
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    enabled = response.ok && anonymousFromSettings(await response.json());
  } catch {
    enabled = false;
  }
  globalCache.__shannonAnon = { at: now, enabled };
  return enabled;
}
