import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBookmarkUrl } from "@/lib/shannon/freeze";
import type { DeclaredUse } from "@/lib/shannon/types";
import { createAnonClient } from "@/lib/supabase/server";
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

function fail(error: { message: string } | null): void {
  if (!error) return;
  if (/already saved/i.test(error.message)) throw new Error("You already saved this page. It is in your library.");
  if (/Unauthorized/i.test(error.message)) throw new Error("Unauthorized user");
  throw new Error(error.message);
}

/** Store for a personal save token. The anon key calls a security-definer function, which writes only the row that owns that token. */
export function createTokenStore(token: string): ProductStore {
  return new TokenStore(createAnonClient(), token.trim());
}

class TokenStore implements ProductStore {
  readonly mode = "supabase" as const;

  constructor(
    private client: SupabaseClient,
    private token: string,
  ) {}

  private async op<T>(action: string, payload: unknown = {}): Promise<T> {
    const result = await this.client.rpc("as_save_token", {
      p_token: this.token,
      p_action: action,
      p_payload: payload ?? {},
    });
    fail(result.error);
    return result.data as T;
  }

  async ensureProfile(): Promise<void> {
    await this.op("profile");
  }

  async ensureSaveToken(): Promise<string> {
    return this.token;
  }

  async findUserIdBySaveToken(token: string): Promise<string | null> {
    if (token.trim() !== this.token) return null;
    const profile = await this.profile("");
    return profile?.id ?? null;
  }

  async profile(_userId: string): Promise<{ id: string; email: string; displayName: string; emailVerified: boolean } | null> {
    const row = await this.op<{ id: string; email: string; displayName: string; emailVerified: boolean } | null>("profile");
    return row ?? null;
  }

  async listUses(_userId: string): Promise<DeclaredUse[]> {
    return this.op<DeclaredUse[]>("list_uses");
  }

  async saveUse(): Promise<void> {
    throw new Error("This action needs a signed-in session.");
  }

  async addUse(): Promise<void> {
    throw new Error("This action needs a signed-in session.");
  }

  async createSource(source: SourceRecord): Promise<void> {
    await this.op("create_source", source);
  }

  async getSource(_userId: string, sourceId: string): Promise<SourceRecord | null> {
    const rows = await this.listSources(_userId);
    return rows.find((row) => row.source_id === sourceId) ?? null;
  }

  async findSourceByUrl(userId: string, url: string): Promise<SourceRecord | null> {
    const key = normalizeBookmarkUrl(url);
    if (!key) return null;
    const rows = await this.listSources(userId);
    return rows.find((row) => row.url && normalizeBookmarkUrl(row.url) === key) ?? null;
  }

  async deleteSource(): Promise<void> {
    throw new Error("This action needs a signed-in session.");
  }

  async listSources(_userId: string): Promise<SourceRecord[]> {
    return (await this.op<SourceRecord[]>("list_sources")) ?? [];
  }

  async createRun(run: RunRecord): Promise<void> {
    await this.op("create_run", run);
  }

  async updateRun(_userId: string, runId: string, patch: Partial<RunRecord>): Promise<void> {
    await this.op("update_run", { run_id: runId, patch });
  }

  async getRun(userId: string, runId: string): Promise<RunRecord | null> {
    const rows = await this.listRuns(userId);
    return rows.find((row) => row.id === runId) ?? null;
  }

  async listRuns(_userId: string): Promise<RunRecord[]> {
    return (await this.op<RunRecord[]>("list_runs")) ?? [];
  }

  async insertProposals(rows: ProposalRecord[]): Promise<void> {
    if (rows.length) await this.op("insert_proposals", rows);
  }

  async listProposals(): Promise<ProposalRecord[]> {
    return [];
  }

  async countNonSkeptic(): Promise<number> {
    return Number((await this.op<number>("count_non_skeptic")) ?? 0);
  }

  async insertConcepts(rows: ConceptRecord[]): Promise<void> {
    if (rows.length) await this.op("insert_concepts", rows);
  }

  async listConcepts(): Promise<ConceptRecord[]> {
    return [];
  }

  async insertCosts(rows: CostEvent[]): Promise<void> {
    if (rows.length) await this.op("insert_costs", rows);
  }

  async listCosts(): Promise<CostEvent[]> {
    return [];
  }

  async insertAudit(rows: AuditEntry[]): Promise<void> {
    if (rows.length) await this.op("insert_audit", rows);
  }

  async listAudit(): Promise<AuditEntry[]> {
    return [];
  }

  async acceptedHistory(userId: string) {
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

  async listRegister(_userId: string): Promise<RegisterEntry[]> {
    return (await this.op<RegisterEntry[]>("list_register")) ?? [];
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

  async decide(): Promise<DecideResult> {
    throw new Error("This action needs a signed-in session.");
  }

  async listChat(): Promise<ChatTurn[]> {
    return [];
  }

  async addChat(): Promise<void> {
    throw new Error("This action needs a signed-in session.");
  }

  async decisionCounts(): Promise<{ accepted: number; reviewed: number }> {
    return { accepted: 0, reviewed: 0 };
  }
}
