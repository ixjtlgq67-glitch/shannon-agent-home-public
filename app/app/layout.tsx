import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/auth";
import { isLiveModels, isSupabaseConfigured, joinOrigin, publicOrigin } from "@/lib/config";
import { OPEN_USER_ID } from "@/lib/open";
import { getStore } from "@/lib/store";
import { anonymousAuthEnabled } from "@/lib/supabase/availability";

export default async function ProductLayout({ children }: { children: ReactNode }) {
  const origin = publicOrigin(await headers());
  const user = await getCurrentUser();
  const jar = await cookies();
  const anonFailed = jar.get("shannon_anon_failed")?.value === "1";
  if (!user) redirect(joinOrigin(origin, "/try"));
  if (user.id === OPEN_USER_ID && !anonFailed && (await anonymousAuthEnabled())) {
    redirect(joinOrigin(origin, "/try"));
  }
  const store = await getStore();
  await store.ensureProfile(user);
  const canned = !isLiveModels();
  const localFallback = isSupabaseConfigured() && store.mode === "memory";
  const modeLabel = localFallback
    ? "Anonymous sign-in is off in Supabase, so this library stays on this machine. Turn on Authentication → Anonymous sign-ins for a private library in Supabase."
    : store.mode === "supabase"
      ? canned
        ? "This library is in Supabase and private to this browser. Agents are canned until OPENAI_API_KEY is set."
        : "This library is in Supabase and private to this browser."
      : canned
        ? "Demo mode. Canned agents and a local store on this machine. Nothing is sent to OpenAI."
        : "OpenAI is connected. Accounts are still the local demo store.";
  return (
    <Shell user={user} modeLabel={modeLabel} showSignOut={store.mode === "supabase"}>
      {children}
    </Shell>
  );
}
