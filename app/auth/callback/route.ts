import { NextResponse } from "next/server";
import { joinOrigin, publicOrigin } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(joinOrigin(publicOrigin(request.headers), "/app"));
}
