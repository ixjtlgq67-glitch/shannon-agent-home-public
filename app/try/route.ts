import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cookieOptions, sessionCookieName } from "@/lib/auth";
import { joinOrigin, publicOrigin } from "@/lib/config";
import { OPEN_SESSION_ID } from "@/lib/open";
import { getMemoryStore } from "@/lib/store/memory";
import { anonymousAuthEnabled } from "@/lib/supabase/availability";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const FAILED = "shannon_anon_failed";

function away(request: Request, path: string) {
  return NextResponse.redirect(joinOrigin(publicOrigin(request.headers), path));
}

async function enter(request: Request) {
  const jar = await cookies();
  if (await anonymousAuthEnabled()) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.signInAnonymously();
      if (!error && data.session) {
        jar.delete(FAILED);
        return away(request, "/app");
      }
    } catch {
      /* fall through to the local library */
    }
  }
  await getMemoryStore().openLocalSession();
  jar.set(sessionCookieName(), OPEN_SESSION_ID, cookieOptions(60 * 60 * 24 * 365));
  jar.set(FAILED, "1", { ...cookieOptions(60), httpOnly: true });
  return away(request, "/app");
}

export async function GET(request: Request) {
  return enter(request);
}

export async function POST(request: Request) {
  return enter(request);
}
