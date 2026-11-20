"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isSupabaseConfigured, joinOrigin, publicOrigin } from "@/lib/config";
import { cookieOptions, getCurrentUser, pendingCookieName, sessionCookieName } from "@/lib/auth";
import { answerFromRegister } from "@/lib/shannon/chat";
import { captureAndRun } from "@/lib/shannon/pipeline";
import { OPEN_SESSION_ID } from "@/lib/open";
import { getMemoryStore } from "@/lib/store/memory";
import { getStore } from "@/lib/store";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DeclaredUse } from "@/lib/shannon/types";
import { randomBytes } from "crypto";

export type FormState = { error: string };

async function go(path: string): Promise<never> {
  redirect(joinOrigin(publicOrigin(await headers()), path));
}

async function verifiedUser() {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in before you continue." as const, user: null };
  return { error: "", user };
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("name") ?? "");
  let nextPath = "/app";
  try {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const origin = publicOrigin(await headers());
      const existing = await supabase.auth.getUser();
      if (existing.data.user?.is_anonymous) {
        const { error } = await supabase.auth.updateUser({
          email: email.trim(),
          password,
          data: { display_name: displayName.trim() },
        });
        if (error) return { error: error.message };
        nextPath = "/app";
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${origin}/auth/callback`,
            data: { display_name: displayName.trim() },
          },
        });
        if (error) return { error: error.message };
        if (!data.session) nextPath = "/signup?sent=1";
      }
    } else {
      if (displayName.trim().length < 2) return { error: "A named reader has to sign the register. Add your name." };
      const { sessionId } = await getMemoryStore().signUp({ email, password, displayName });
      const jar = await cookies();
      jar.set(sessionCookieName(), sessionId, cookieOptions(60 * 60 * 24 * 14));
      jar.delete(pendingCookieName());
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not open a register." };
  }
  return go(nextPath);
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { error: error.message };
    } else {
      const { sessionId } = await getMemoryStore().login(email, password);
      const jar = await cookies();
      jar.set(sessionCookieName(), sessionId, cookieOptions(60 * 60 * 24 * 14));
      jar.delete(pendingCookieName());
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not sign in." };
  }
  const next = String(formData.get("next") ?? "");
  return go(next.startsWith("/") && !next.startsWith("//") ? next : "/app");
}

export async function signOut() {
  const jar = await cookies();
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  const sid = jar.get(sessionCookieName())?.value;
  if (sid && sid !== OPEN_SESSION_ID) await getMemoryStore().logout(sid);
  jar.delete(sessionCookieName());
  jar.delete("shannon_anon_failed");
  return go("/");
}

export async function saveSource(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await verifiedUser();
  if (!gate.user) return { error: gate.error };
  const store = await getStore();
  await store.ensureProfile(gate.user);
  let runId = "";
  try {
    const result = await captureAndRun({
      user: gate.user,
      store,
      title: String(formData.get("title") ?? ""),
      url: String(formData.get("url") ?? "").trim() || null,
      text: String(formData.get("text") ?? ""),
    });
    if ("error" in result) return { error: result.error };
    runId = result.runId;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The panel did not finish." };
  }
  revalidatePath("/app");
  return go(`/app/review/${runId}`);
}

export async function removeBookmark(formData: FormData): Promise<void> {
  const gate = await verifiedUser();
  if (!gate.user) return go("/login");
  const sourceId = String(formData.get("source_id") ?? "");
  const store = await getStore();
  try {
    await store.deleteSource(gate.user.id, sourceId);
  } catch (error) {
    return go(`/app?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not remove that site.")}`);
  }
  revalidatePath("/app");
  return go("/app");
}

export async function decideProposal(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await verifiedUser();
  if (!gate.user) return { error: gate.error };
  const proposalId = String(formData.get("proposal_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "accept" && decision !== "reject") return { error: "Choose accept or reject." };
  const reason = String(formData.get("reason") ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
  const store = await getStore();
  let runId = "";
  let status: "accepted" | "rejected" = "accepted";
  try {
    const result = await store.decide({
      userId: gate.user.id,
      proposalId,
      action: decision,
      reason,
      humanName: gate.user.displayName,
    });
    runId = result.runId;
    status = result.status;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not record that decision." };
  }
  revalidatePath("/app/register");
  revalidatePath("/app/ledger");
  revalidatePath(`/app/review/${runId}`);
  return go(`/app/review/${runId}?saved=${status}`);
}

export async function saveDeclaredUse(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await verifiedUser();
  if (!gate.user) return { error: gate.error };
  const use: DeclaredUse = {
    use_id: String(formData.get("use_id") ?? ""),
    description: String(formData.get("description") ?? "").slice(0, 400),
    taste_profile: String(formData.get("taste_profile") ?? "").slice(0, 600),
    enabled: formData.get("enabled") === "on",
    requires_history: formData.get("requires_history") === "on",
  };
  if (!use.description.trim()) return { error: "Describe what this use is for." };
  try {
    const store = await getStore();
    if (formData.get("mode") === "add") await store.addUse(gate.user.id, use);
    else await store.saveUse(gate.user.id, use);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save that use." };
  }
  revalidatePath("/app/uses");
  return go("/app/uses");
}

export async function askRegister(_prev: FormState, formData: FormData): Promise<FormState> {
  const gate = await verifiedUser();
  if (!gate.user) return { error: gate.error };
  const question = String(formData.get("question") ?? "").trim().slice(0, 1000);
  if (question.length < 3) return { error: "Ask about a judgment you might have kept." };
  const store = await getStore();
  const entries = await store.listRegister(gate.user.id);
  const answer = await answerFromRegister({
    userId: gate.user.id,
    question,
    entries: entries.map((entry) => ({ ...entry, status: "accepted" as const })),
  });
  const now = new Date().toISOString();
  await store.addChat({
    id: `chat_${randomBytes(6).toString("hex")}`,
    user_id: gate.user.id,
    role: "user",
    text: question,
    citations: [],
    gaps: [],
    created_at: now,
  });
  await store.addChat({
    id: `chat_${randomBytes(6).toString("hex")}`,
    user_id: gate.user.id,
    role: "shannon",
    text: [answer.title, ...answer.statements.map((statement) => statement.text)].filter(Boolean).join("\n\n"),
    citations: answer.citations,
    gaps: answer.gaps,
    created_at: new Date().toISOString(),
  });
  await store.insertCosts([
    {
      id: `cost_${randomBytes(6).toString("hex")}`,
      user_id: gate.user.id,
      run_id: null,
      agent_id: "chatbot",
      model_id: answer.model_id,
      prompt_version: answer.prompt_version,
      status: answer.input_tokens === null && answer.model_id === "unavailable" ? "error" : "ok",
      input_tokens: answer.input_tokens,
      output_tokens: answer.output_tokens,
      estimated_cost_usd: answer.estimated_cost_usd,
      price_version: answer.price_version,
      latency_ms: answer.latency_ms,
      retry_of: null,
      created_at: new Date().toISOString(),
    },
  ]);
  revalidatePath("/app/chat");
  revalidatePath("/app/ledger");
  return go("/app/chat");
}
