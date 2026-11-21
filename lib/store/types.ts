import type {
  ConceptResult,
  CostStatus,
  DeclaredUse,
  FrozenSource,
  HistoryItem,
  HumanDecision,
  Proposal,
  ProposalStatus,
  RunStatus,
} from "@/lib/shannon/types";

export type SourceRecord = FrozenSource & {
  title: string;
  url: string | null;
  origin: "url" | "paste";
  captured_at: string;
  favicon_url: string | null;
  excerpted: boolean;
};

export type RunRecord = {
  id: string;
  user_id: string;
  source_id: string;
  status: RunStatus;
  planned_roles: string[];
  successful_roles: string[];
  failed_roles: Array<{ role_id: string; reason: string }>;
  skipped_roles: string[];
  call_budget: number;
  calls_used: number;
  usd_budget: number;
  started_at: string;
  finished_at: string | null;
};

export type ProposalRecord = Proposal & {
  run_id: string;
  status: ProposalStatus;
  drop_reason: string | null;
  created_at: string;
};

export type RegisterEntry = {
  id: string;
  user_id: string;
  proposal_id: string;
  run_id: string;
  source_id: string;
  source_title: string;
  source_version: string;
  quote: string;
  paragraph_id: string;
  judgment: string;
  reasoning: string;
  role_id: string;
  use_id: string | null;
  model_id: string;
  prompt_version: string;
  human_name: string;
  reason: string;
  decided_at: string;
};

export type AuditEntry = {
  id: string;
  user_id: string;
  run_id: string | null;
  kind: "rejection" | "quote_dropped" | "role_failed" | "budget" | "storage";
  summary: string;
  proposal_id: string | null;
  created_at: string;
};

export type CostEvent = {
  id: string;
  user_id: string;
  run_id: string | null;
  agent_id: string;
  model_id: string;
  prompt_version: string;
  status: CostStatus;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  price_version: string | null;
  latency_ms: number | null;
  retry_of: string | null;
  created_at: string;
};

export type ConceptRecord = ConceptResult["concepts"][number] & {
  id: string;
  user_id: string;
  run_id: string;
};

export type ChatTurn = {
  id: string;
  user_id: string;
  role: "user" | "shannon";
  text: string;
  citations: Array<{ id: string; quote: string; judgment: string }>;
  gaps: string[];
  created_at: string;
};

export type DecideResult = {
  status: "accepted" | "rejected";
  runId: string;
  registerEntry: RegisterEntry | null;
  audit: HumanDecision;
};

export interface ProductStore {
  mode: "memory" | "supabase";
  ensureProfile(user: { id: string; email: string; displayName: string }): Promise<void>;
  ensureSaveToken(userId: string): Promise<string>;
  findUserIdBySaveToken(token: string): Promise<string | null>;
  profile(userId: string): Promise<{ id: string; email: string; displayName: string; emailVerified: boolean } | null>;
  listUses(userId: string): Promise<DeclaredUse[]>;
  saveUse(userId: string, use: DeclaredUse): Promise<void>;
  addUse(userId: string, use: DeclaredUse): Promise<void>;
  createSource(source: SourceRecord): Promise<void>;
  getSource(userId: string, sourceId: string): Promise<SourceRecord | null>;
  findSourceByUrl(userId: string, url: string): Promise<SourceRecord | null>;
  deleteSource(userId: string, sourceId: string): Promise<void>;
  listSources(userId: string): Promise<SourceRecord[]>;
  createRun(run: RunRecord): Promise<void>;
  updateRun(userId: string, runId: string, patch: Partial<RunRecord>): Promise<void>;
  getRun(userId: string, runId: string): Promise<RunRecord | null>;
  listRuns(userId: string): Promise<RunRecord[]>;
  insertProposals(rows: ProposalRecord[]): Promise<void>;
  listProposals(userId: string, runId: string): Promise<ProposalRecord[]>;
  countNonSkeptic(userId: string): Promise<number>;
  insertConcepts(rows: ConceptRecord[]): Promise<void>;
  listConcepts(userId: string, runId: string): Promise<ConceptRecord[]>;
  insertCosts(rows: CostEvent[]): Promise<void>;
  listCosts(userId: string): Promise<CostEvent[]>;
  insertAudit(rows: AuditEntry[]): Promise<void>;
  listAudit(userId: string): Promise<AuditEntry[]>;
  acceptedHistory(userId: string): Promise<HistoryItem[]>;
  listRegister(userId: string): Promise<RegisterEntry[]>;
  searchRegister(userId: string, query: string): Promise<RegisterEntry[]>;
  decide(args: {
    userId: string;
    proposalId: string;
    action: "accept" | "reject";
    reason: string;
    humanName: string;
    decidedAt?: string;
  }): Promise<DecideResult>;
  listChat(userId: string): Promise<ChatTurn[]>;
  addChat(turn: ChatTurn): Promise<void>;
  decisionCounts(userId: string): Promise<{ accepted: number; reviewed: number }>;
}
