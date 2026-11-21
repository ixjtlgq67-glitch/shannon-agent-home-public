import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieOptions, pendingCookieName, sessionCookieName } from "@/lib/auth";
import { isSupabaseConfigured, joinOrigin, publicOrigin } from "@/lib/config";
import { getMemoryStore } from "@/lib/store/memory";

function send(request: Request, path: string) {
  return NextResponse.redirect(joinOrigin(publicOrigin(request.headers), path));
}

export async function GET(request: Request) {
  if (isSupabaseConfigured()) return send(request, "/login");
  const token = new URL(request.url).searchParams.get("token") ?? "";
  try {
    const { sessionId } = await getMemoryStore().confirm(token);
    const jar = await cookies();
    jar.set(sessionCookieName(), sessionId, cookieOptions(60 * 60 * 24 * 14));
    jar.delete(pendingCookieName());
    return send(request, "/app");
  } catch (error) {
    const message = error instanceof Error ? error.message : "That confirmation link is not valid.";
    return send(request, `/login?error=${encodeURIComponent(message)}`);
  }
}
