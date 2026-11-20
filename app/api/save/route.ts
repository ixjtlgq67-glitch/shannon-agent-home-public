import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/config";
import { isOpenDemo, OPEN_SESSION_ID } from "@/lib/open";
import { captureAndRun } from "@/lib/shannon/pipeline";
import { getStore } from "@/lib/store";
import { getMemoryStore } from "@/lib/store/memory";
import { createTokenStore } from "@/lib/store/token-store";
import type { ProductStore } from "@/lib/store/types";

export const dynamic = "force-dynamic";

function codeFor(message: string): string {
  if (/already saved/i.test(message)) return "duplicate";
  if (/PDF/i.test(message)) return "pdf";
  if (/blocked|wall/i.test(message)) return "blocked";
  if (/web address/i.test(message)) return "bad-url";
  if (/not found/i.test(message)) return "not-found";
  if (/paste/i.test(message)) return "need-paste";
  return "failed";
}

export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(\S+)/i.exec(header)?.[1] ?? "";
  const sessionUser = await getCurrentUser();
  let store: ProductStore;
  let user = sessionUser;
  if (sessionUser) {
    store = await getStore();
  } else if (bearer && isSupabaseConfigured()) {
    store = createTokenStore(bearer);
    user = await store.profile("");
  } else {
    store = await getStore();
    if (bearer) user = await store.profile((await store.findUserIdBySaveToken(bearer)) ?? "");
  }
  if (!user && isOpenDemo()) {
    store = getMemoryStore();
    user = await getMemoryStore().userForSession(OPEN_SESSION_ID);
  }
  if (!user) {
    return Response.json({ ok: false, code: "unauthorized" }, { status: 401 });
  }
  let body: { url?: string; title?: string; text?: string; favicon?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, code: "bad-request" }, { status: 400 });
  }
  const url = String(body.url ?? "").trim();
  const text = String(body.text ?? "");
  const title = String(body.title ?? "").trim();
  if (!url) return Response.json({ ok: false, code: "bad-request" }, { status: 400 });
  try {
    const result = await captureAndRun({
      user,
      store,
      title,
      url,
      text,
      preferSuppliedText: text.trim().length >= 40,
      favicon: body.favicon ? String(body.favicon) : null,
    });
    if ("error" in result) {
      return Response.json({ ok: false, code: codeFor(result.error), message: result.error }, { status: 422 });
    }
    const existing = await store.findSourceByUrl(user.id, url);
    return Response.json({
      ok: true,
      code: "saved",
      runId: result.runId,
      reviewPath: `/app/review/${result.runId}`,
      title: existing?.title ?? title,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save that page.";
    return Response.json({ ok: false, code: codeFor(message), message }, { status: 422 });
  }
}
