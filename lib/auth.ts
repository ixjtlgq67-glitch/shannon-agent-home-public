import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/config";
import { getMemoryStore } from "@/lib/store/memory";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
};

const SESSION_COOKIE = "shannon_session";
const PENDING_COOKIE = "shannon_pending";

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export function pendingCookieName() {
  return PENDING_COOKIE;
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge,
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      const meta = data.user.user_metadata?.display_name;
      const fromEmail = data.user.email?.split("@")[0];
      const displayName = typeof meta === "string" && meta.trim() ? meta.trim() : fromEmail || "Reader";
      return {
        id: data.user.id,
        email: data.user.email ?? "",
        displayName,
        emailVerified: Boolean(data.user.email_confirmed_at),
      };
    }
  }
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  return getMemoryStore().userForSession(sid);
}

export async function pendingUserId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(PENDING_COOKIE)?.value ?? null;
}
