import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBookmarkUrl } from "@/lib/shannon/freeze";
import { DEFAULT_USES, type DeclaredUse, type HistoryItem } from "@/lib/shannon/types";
import type {
  AuditEntry,
  ChatTurn,
  ConceptRecord,
  CostEvent,
  DecideResult,
  ProductStore,
  ProposalRecord,
  RegisterEntry,
  RunRecord,
  SourceRecord,
} from "./types";

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function mapRegister(row: Record<string, unknown>): RegisterEntry {
  return row as unknown as RegisterEntry;
}

export class SupabaseStore implements ProductStore {
  readonly mode = "supabase" as const;

  constructor(private client: SupabaseClient) {}

  async ensureSaveToken(userId: string): Promise<string> {
    const existing = await this.client.from("profiles").select("save_token").eq("id", userId).maybeSingle();
    fail(existing.error);
    const current = existing.data?.save_token as string | null | undefined;
    if (current) return current;
    const token = randomBytes(24).toString("hex");
    fail((await this.client.from("profiles").update({ save_token: token }).eq("id", userId)).error);
    return token;
  }

  async findUserIdBySaveToken(token: string): Promise<string | null> {
    const trimmed = token.trim();
    if (trimmed.length < 16) return null;
    const result = await this.client.rpc("as_save_token", { p_token: trimmed, p_action: "profile", p_payload: {} });
    if (result.error || !result.data) return null;
    const id = (result.data as { id?: string }).id;
    return id ?? null;
  }

  async profile(userId: string): Promise<{ id: string; email: string; displayName: string; emailVerified: boolean } | null> {
    const result = await this.client.from("profiles").select("id, email, display_name").eq("id", userId).maybeSingle();
    fail(result.error);
    if (!result.data) return null;
    return {
      id: String(result.data.id),
      email: String(result.data.email ?? ""),
      displayName: String(result.data.display_name ?? "Reader"),
      emailVerified: true,
    };
  }

  async ensureProfile(user: { id: string; email: string; displayName: string }): Promise<void> {
    const existing = await this.client.from("profiles").select("id").eq("id", user.id).maybeSingle();
    fail(existing.error);
    if (!existing.data) {
      fail(
        (
          await this.client.from("profiles").insert({
            id: user.id,
            email: user.email,
            display_name: user.displayName,
          })
        ).error,
      );
    }
    const uses = await this.client.from("declared_uses").select("use_id").eq("user_id", user.id);
    fail(uses.error);
    if (!uses.data?.length) {
      fail(
        (
          await this.client.from("declared_uses").insert(
            DEFAULT_USES.map((use) => ({ ...use, user_id: user.id })),
          )
        ).error,
      );
    }
  }

  async listUses(userId: string): Promise<DeclaredUse[]> {
    const result = await this.client
      .from("declared_uses")
      .select("use_id, description, taste_profile, enabled, requires_history")
      .eq("user_id", userId)
      .order("use_id");
    fail(result.error);
    return (result.data ?? []) as DeclaredUse[];
  }

  async saveUse(userId: string, use: DeclaredUse): Promise<void> {
    const result = await this.client
      .from("declared_uses")
      .update({
        description: use.description.trim(),
        taste_profile: use.taste_profile.trim(),
        enabled: use.enabled,
        requires_history: use.requires_history,
      })
      .eq("user_id", userId)
      .eq("use_id", use.use_id);
    fail(result.error);
  }

  async addUse(userId: string, use: DeclaredUse): Promise<void> {
    if (!/^[a-z][a-z0-9-]{1,32}$/.test(use.use_id)) throw new Error("Use an id like teaching or field-notes.");
    if (use.use_id === "skeptic") throw new Error("The Skeptic is standing. It is not a declared use.");
    const count = await this.client.from("declared_uses").select("use_id", { count: "exact", head: true }).eq("user_id", userId);
    fail(count.error);
    if ((count.count ?? 0) >= 8) throw new Error("Eight declared uses is the cap for this prototype.");
    fail(
      (
        await this.client.from("declared_uses").insert({
          user_id: userId,
          use_id: use.use_id,
          description: use.description.trim(),
          taste_profile: use.taste_profile.trim(),
          enabled: use.enabled,
          requires_history: use.requires_history,
        })
      ).error,
    );
  }

  async createSource(source: SourceRecord): Promise<void> {
    const inserted = await this.client.from("sources").insert({
          user_id: source.user_id,
          source_id: source.source_id,
          source_version: source.source_version,
          title: source.title,
          url: source.url,
          origin: source.origin,
          captured_at: source.captured_at,
          favicon_url: source.favicon_url,
          excerpted: source.excerpted,
        });
    if (inserted.error) {
      if (inserted.error.code === "23505" || /sources_user_url/i.test(inserted.error.message)) {
        throw new Error("You already saved this page. It is in your library.");
      }
      throw new Error(inserted.error.message);
    }
    fail(
      (
        await this.client.from("paragraphs").insert(
          source.paragraphs.map((paragraph, index) => ({
            user_id: source.user_id,
            source_id: source.source_id,
            paragraph_id: paragraph.id,
            ordinal: index + 1,
            text: paragraph.text,
          })),
        )
      ).error,
    );
  }

  private async hydrate(userId: string, row: Record<string, unknown>): Promise<SourceRecord> {
    const paragraphs = await this.client
      .from("paragraphs")
      .select("paragraph_id, text, ordinal")
      .eq("user_id", userId)
      .eq("source_id", row.source_id as string)
      .order("ordinal");
    fail(paragraphs.error);
    return {
      user_id: userId,
      source_id: String(row.source_id),
      source_version: String(row.source_version),
      title: String(row.title),
      url: (row.url as string | null) ?? null,
      origin: row.origin as "url" | "paste",
      captured_at: String(row.captured_at),
      favicon_url: (row.favicon_url as string | null) ?? null,
      excerpted: Boolean(row.excerpted),
      paragraphs: (paragraphs.data ?? []).map((paragraph) => ({
        id: String(paragraph.paragraph_id),
        text: String(paragraph.text),
      })),
    };
  }

  async getSource(userId: string, sourceId: string): Promise<SourceRecord | null> {
    const result = await this.client.from("sources").select("*").eq("user_id", userId).eq("source_id", sourceId).maybeSingle();
    fail(result.error);
    if (!result.data) return null;
    return this.hydrate(userId, result.data);
  }

  async findSourceByUrl(userId: string, url: string): Promise<SourceRecord | null> {
    const key = normalizeBookmarkUrl(url);
    if (!key) return null;
    const sources = await this.listSources(userId);
    return sources.find((source) => source.url && normalizeBookmarkUrl(source.url) === key) ?? null;
  }

  async deleteSource(userId: string, sourceId: string): Promise<void> {
    const runs = await this.client.from("runs").select("id").eq("user_id", userId).eq("source_id", sourceId);
    fail(runs.error);
    const runIds = (runs.data ?? []).map((run) => String(run.id));
    if (runIds.length) {
      fail((await this.client.from("concepts").delete().eq("user_id", userId).in("run_id", runIds)).error);
      fail((await this.client.from("runs").delete().eq("user_id", userId).eq("source_id", sourceId)).error);
    }
    const removed = await this.client.from("sources").delete().eq("user_id", userId).eq("source_id", sourceId).select("source_id");
    fail(removed.error);
    if (!removed.data?.length) throw new Error("That site is not in your library.");
  }

  async listSources(userId: string): Promise<SourceRecord[]> {
    const result = await this.client.from("sources").select("*").eq("user_id", userId).order("captured_at", { ascending: false });
    fail(result.error);
    const rows = [];
    for (const row of result.data ?? []) rows.push(await this.hydrate(userId, row));
    return rows;
  }

  async createRun(run: RunRecord): Promise<void> {
    fail((await this.client.from("runs").insert(run)).error);
  }

  async updateRun(userId: string, runId: string, patch: Partial<RunRecord>): Promise<void> {
    const rest: Partial<RunRecord> = { ...patch };
    delete rest.id;
    delete rest.user_id;
    fail((await this.client.from("runs").update(rest).eq("user_id", userId).eq("id", runId)).error);
  }

  async getRun(userId: string, runId: string): Promise<RunRecord | null> {
    const result = await this.client.from("runs").select("*").eq("user_id", userId).eq("id", runId).maybeSingle();
    fail(result.error);
    return (result.data as RunRecord | null) ?? null;
  }

  async listRuns(userId: string): Promise<RunRecord[]> {
    const result = await this.client.from("runs").select("*").eq("user_id", userId).order("started_at", { ascending: false });
    fail(result.error);
    return (result.data ?? []) as RunRecord[];
  }

  async insertProposals(rows: ProposalRecord[]): Promise<void> {
    if (!rows.length) return;
    fail((await this.client.from("proposals").insert(rows)).error);
  }

  async listProposals(userId: string, runId: string): Promise<ProposalRecord[]> {
    const result = await this.client.from("proposals").select("*").eq("user_id", userId).eq("run_id", runId);
    fail(result.error);
    return (result.data ?? []) as ProposalRecord[];
  }

  async countNonSkeptic(userId: string): Promise<number> {
    const result = await this.client
      .from("proposals")
      .select("proposal_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .neq("role_id", "skeptic")
      .neq("status", "dropped");
    fail(result.error);
    return result.count ?? 0;
  }

  async insertConcepts(rows: ConceptRecord[]): Promise<void> {
    if (!rows.length) return;
    fail((await this.client.from("concepts").insert(rows)).error);
  }

  async listConcepts(userId: string, runId: string): Promise<ConceptRecord[]> {
    const result = await this.client.from("concepts").select("*").eq("user_id", userId).eq("run_id", runId);
    fail(result.error);
    return (result.data ?? []) as ConceptRecord[];
  }

  async insertCosts(rows: CostEvent[]): Promise<void> {
    if (!rows.length) return;
    fail((await this.client.from("cost_events").insert(rows)).error);
  }

  async listCosts(userId: string): Promise<CostEvent[]> {
    const result = await this.client.from("cost_events").select("*").eq("user_id", userId).order("created_at");
    fail(result.error);
    return (result.data ?? []) as CostEvent[];
  }

  async insertAudit(rows: AuditEntry[]): Promise<void> {
    if (!rows.length) return;
    fail((await this.client.from("audit_log").insert(rows)).error);
  }

  async listAudit(userId: string): Promise<AuditEntry[]> {
    const result = await this.client.from("audit_log").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    fail(result.error);
    return (result.data ?? []) as AuditEntry[];
  }

  async acceptedHistory(userId: string): Promise<HistoryItem[]> {
    const rows = await this.listRegister(userId);
    return rows.map((entry) => ({
      user_id: entry.user_id,
      status: "accepted" as const,
      id: entry.id,
      quote: entry.quote,
      judgment: entry.judgment,
      reasoning: entry.reasoning,
      decided_at: entry.decided_at,
      role_id: entry.role_id,
      source_id: entry.source_id,
    }));
  }

  async listRegister(userId: string): Promise<RegisterEntry[]> {
    const result = await this.client.from("register_entries").select("*").eq("user_id", userId).order("decided_at", { ascending: false });
    fail(result.error);
    return (result.data ?? []).map((row) => mapRegister(row));
  }

  async searchRegister(userId: string, query: string): Promise<RegisterEntry[]> {
    const rows = await this.listRegister(userId);
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((entry) =>
      [entry.quote, entry.judgment, entry.reasoning, entry.role_id, entry.source_title, entry.paragraph_id, entry.human_name]
        .join("\n")
        .toLowerCase()
        .includes(needle),
    );
  }

  async decide(args: {
    userId: string;
    proposalId: string;
    action: "accept" | "reject";
    reason: string;
    humanName: string;
  }): Promise<DecideResult> {
    const result = await this.client.rpc("decide_proposal", {
      p_proposal_id: args.proposalId,
      p_action: args.action,
      p_reason: args.reason,
      p_human_name: args.humanName,
    });
    if (result.error) {
      const message = result.error.message;
      if (message.includes("Named human")) throw new Error("Named human required");
      if (message.includes("Unauthorized")) throw new Error("Unauthorized user");
      if (message.includes("finalized")) throw new Error("Decision already finalized");
      if (message.includes("Quote")) throw new Error("Quote does not match its frozen paragraph");
      throw new Error("That decision could not be recorded.");
    }
    const payload = result.data as { status: "accepted" | "rejected"; run_id: string };
    const register = payload.status === "accepted" ? await this.listRegister(args.userId) : [];
    const registerEntry = register.find((entry) => entry.proposal_id === args.proposalId) ?? null;
    return {
      status: payload.status,
      runId: payload.run_id,
      registerEntry,
      audit: {
        proposal_id: args.proposalId,
        user_id: args.userId,
        human_name: args.humanName,
        action: args.action,
        reason: args.reason,
        decided_at: registerEntry?.decided_at ?? new Date().toISOString(),
      },
    };
  }

  async listChat(userId: string): Promise<ChatTurn[]> {
    const result = await this.client.from("chat_messages").select("*").eq("user_id", userId).order("created_at");
    fail(result.error);
    return (result.data ?? []) as ChatTurn[];
  }

  async addChat(turn: ChatTurn): Promise<void> {
    fail((await this.client.from("chat_messages").insert(turn)).error);
  }

  async decisionCounts(userId: string): Promise<{ accepted: number; reviewed: number }> {
    const accepted = await this.client
      .from("proposals")
      .select("proposal_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "accepted");
    const rejected = await this.client
      .from("proposals")
      .select("proposal_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "rejected");
    fail(accepted.error);
    fail(rejected.error);
    const acceptedCount = accepted.count ?? 0;
    return { accepted: acceptedCount, reviewed: acceptedCount + (rejected.count ?? 0) };
  }
}
