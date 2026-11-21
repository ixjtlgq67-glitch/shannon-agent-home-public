import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, statSync } from "fs";
import path from "path";
import { applyDecision } from "@/lib/shannon/core";
import { normalizeBookmarkUrl } from "@/lib/shannon/freeze";
import { DEFAULT_USES, type DeclaredUse, type HistoryItem } from "@/lib/shannon/types";
import { isOpenDemo, OPEN_SAVE_TOKEN, OPEN_SESSION_ID, OPEN_USER_ID } from "@/lib/open";
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

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  email_verified_at: string | null;
  save_token: string | null;
  created_at: string;
};

type SessionRow = { id: string; user_id: string; expires_at: string };
type MailRow = {
  id: string;
  user_id: string;
  to: string;
  subject: string;
  body: string;
  token: string;
  created_at: string;
};

type Database = {
  users: UserRow[];
  sessions: SessionRow[];
  mailbox: MailRow[];
  uses: Array<DeclaredUse & { user_id: string }>;
  sources: SourceRecord[];
  runs: RunRecord[];
  proposals: ProposalRecord[];
  register: RegisterEntry[];
  audit: AuditEntry[];
  costs: CostEvent[];
  concepts: ConceptRecord[];
  chat: ChatTurn[];
};

function emptyDb(): Database {
  return {
    users: [],
    sessions: [],
    mailbox: [],
    uses: [],
    sources: [],
    runs: [],
    proposals: [],
    register: [],
    audit: [],
    costs: [],
    concepts: [],
    chat: [],
  };
}

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function matches(entry: RegisterEntry, query: string): boolean {
  const haystack = [
    entry.quote,
    entry.judgment,
    entry.reasoning,
    entry.role_id,
    entry.source_title,
    entry.paragraph_id,
    entry.human_name,
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export class MemoryStore implements ProductStore {
  readonly mode = "memory" as const;
  private db: Database;
  private chain: Promise<unknown> = Promise.resolve();
  private loadedMtime = 0;

  constructor(private file: string) {
    this.db = this.read();
    if (this.ensureOpenReader()) this.flush();
  }

  private read(): Database {
    if (!existsSync(this.file)) return emptyDb();
    this.loadedMtime = statSync(this.file).mtimeMs;
    const parsed = JSON.parse(readFileSync(this.file, "utf8")) as Database;
    return { ...emptyDb(), ...parsed };
  }

  private flush() {
    const dir = path.dirname(this.file);
    mkdirSync(dir, { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.db));
    renameSync(tmp, this.file);
    this.loadedMtime = statSync(this.file).mtimeMs;
  }

  private reloadIfChanged() {
    if (!existsSync(this.file)) return;
    const mtime = statSync(this.file).mtimeMs;
    if (mtime !== this.loadedMtime) {
      this.db = this.read();
      if (this.ensureOpenReader()) this.flush();
    }
  }

  openLocalSession(): Promise<string> {
    return this.transaction(() => {
      this.ensureOpenReader(true);
      return OPEN_SESSION_ID;
    });
  }

  private ensureOpenReader(force = false): boolean {
    if (!force && !isOpenDemo()) return false;
    let changed = false;
    if (!this.db.users.some((user) => user.id === OPEN_USER_ID)) {
      const now = new Date().toISOString();
      this.db.users.push({
        id: OPEN_USER_ID,
        email: "reader@shannon.local",
        display_name: "Reader",
        password_hash: "open",
        email_verified_at: now,
        save_token: OPEN_SAVE_TOKEN,
        created_at: now,
      });
      for (const use of DEFAULT_USES) this.db.uses.push({ ...use, user_id: OPEN_USER_ID });
      changed = true;
    }
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const session = this.db.sessions.find((item) => item.id === OPEN_SESSION_ID);
    if (!session) {
      this.db.sessions.push({ id: OPEN_SESSION_ID, user_id: OPEN_USER_ID, expires_at: expires });
      changed = true;
    } else if (session.expires_at < new Date().toISOString() || session.user_id !== OPEN_USER_ID) {
      session.expires_at = expires;
      session.user_id = OPEN_USER_ID;
      changed = true;
    }
    return changed;
  }

  private transaction<T>(fn: () => T): Promise<T> {
    const run = this.chain.then(() => {
      this.reloadIfChanged();
      const result = fn();
      this.flush();
      return result;
    });
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private seedUses(userId: string) {
    if (this.db.uses.some((use) => use.user_id === userId)) return;
    for (const use of DEFAULT_USES) this.db.uses.push({ ...use, user_id: userId });
  }

  signUp(input: { email: string; password: string; displayName: string }): Promise<{ userId: string; token: string; sessionId: string }> {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a real email address.");
    if (displayName.length < 2) throw new Error("A named reader has to sign the register. Add your name.");
    if (input.password.length < 8) throw new Error("Use a password of at least 8 characters.");
    return this.transaction(() => {
      if (this.db.users.some((user) => user.email === email)) {
        throw new Error("That email already has a register. Sign in instead.");
      }
      const userId = newId("usr");
      const token = randomBytes(24).toString("hex");
      const sessionId = randomBytes(24).toString("hex");
      const now = new Date().toISOString();
      this.db.users.push({
        id: userId,
        email,
        display_name: displayName,
        password_hash: hashPassword(input.password),
        email_verified_at: now,
        save_token: randomBytes(24).toString("hex"),
        created_at: now,
      });
      this.seedUses(userId);
      this.db.sessions.push({
        id: sessionId,
        user_id: userId,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
      this.db.mailbox.push({
        id: newId("mail"),
        user_id: userId,
        to: email,
        subject: "Your Shannon register is open",
        body: `${displayName}, the register is ready. Confirming this address is optional.`,
        token,
        created_at: now,
      });
      return { userId, token, sessionId };
    });
  }

  guest(): Promise<{ userId: string; sessionId: string }> {
    const suffix = randomBytes(4).toString("hex");
    return this.signUp({
      email: `guest.${suffix}@example.com`,
      password: randomBytes(18).toString("hex"),
      displayName: "Guest reader",
    }).then(({ userId, sessionId }) => ({ userId, sessionId }));
  }

  mailboxFor(userId: string): Promise<MailRow[]> {
    return this.transaction(() => this.db.mailbox.filter((mail) => mail.user_id === userId));
  }

  confirm(token: string): Promise<{ sessionId: string; userId: string }> {
    return this.transaction(() => {
      const mail = this.db.mailbox.find((item) => item.token === token);
      if (!mail) throw new Error("That confirmation link is not valid.");
      const user = this.db.users.find((item) => item.id === mail.user_id);
      if (!user) throw new Error("That confirmation link is not valid.");
      user.email_verified_at = user.email_verified_at ?? new Date().toISOString();
      const sessionId = randomBytes(24).toString("hex");
      this.db.sessions.push({
        id: sessionId,
        user_id: user.id,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
      return { sessionId, userId: user.id };
    });
  }

  login(email: string, password: string): Promise<{ sessionId: string; userId: string }> {
    const normalized = email.trim().toLowerCase();
    return this.transaction(() => {
      const user = this.db.users.find((item) => item.email === normalized);
      if (!user || !verifyPassword(password, user.password_hash)) {
        throw new Error("Email or password does not match.");
      }
      user.email_verified_at = user.email_verified_at ?? new Date().toISOString();
      const sessionId = randomBytes(24).toString("hex");
      this.db.sessions.push({
        id: sessionId,
        user_id: user.id,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
      return { sessionId, userId: user.id };
    });
  }

  logout(sessionId: string): Promise<void> {
    return this.transaction(() => {
      this.db.sessions = this.db.sessions.filter((session) => session.id !== sessionId);
    });
  }

  userForSession(sessionId: string): Promise<{ id: string; email: string; displayName: string; emailVerified: boolean } | null> {
    return this.transaction(() => {
      const session = this.db.sessions.find((item) => item.id === sessionId);
      if (!session || session.expires_at < new Date().toISOString()) return null;
      const user = this.db.users.find((item) => item.id === session.user_id);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        emailVerified: Boolean(user.email_verified_at),
      };
    });
  }

  ensureSaveToken(userId: string): Promise<string> {
    return this.transaction(() => {
      const user = this.db.users.find((item) => item.id === userId);
      if (!user) throw new Error("Unauthorized user");
      if (!user.save_token) user.save_token = randomBytes(24).toString("hex");
      return user.save_token;
    });
  }

  findUserIdBySaveToken(token: string): Promise<string | null> {
    const trimmed = token.trim();
    if (trimmed.length < 16) return Promise.resolve(null);
    return this.transaction(() => this.db.users.find((user) => user.save_token === trimmed)?.id ?? null);
  }

  profile(userId: string): Promise<{ id: string; email: string; displayName: string; emailVerified: boolean } | null> {
    return this.transaction(() => {
      const user = this.db.users.find((item) => item.id === userId);
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        emailVerified: Boolean(user.email_verified_at),
      };
    });
  }

  async ensureProfile(user: { id: string; email: string; displayName: string }): Promise<void> {
    await this.transaction(() => {
      this.seedUses(user.id);
    });
  }

  listUses(userId: string): Promise<DeclaredUse[]> {
    return this.transaction(() =>
      this.db.uses
        .filter((use) => use.user_id === userId)
        .map((use) => ({
          use_id: use.use_id,
          description: use.description,
          taste_profile: use.taste_profile,
          enabled: use.enabled,
          requires_history: use.requires_history,
        })),
    );
  }

  saveUse(userId: string, use: DeclaredUse): Promise<void> {
    return this.transaction(() => {
      const row = this.db.uses.find((item) => item.user_id === userId && item.use_id === use.use_id);
      if (!row) throw new Error("That use is not on your register.");
      row.description = use.description.trim();
      row.taste_profile = use.taste_profile.trim();
      row.enabled = use.enabled;
      row.requires_history = use.requires_history;
    });
  }

  addUse(userId: string, use: DeclaredUse): Promise<void> {
    return this.transaction(() => {
      if (!/^[a-z][a-z0-9-]{1,32}$/.test(use.use_id)) throw new Error("Use an id like teaching or field-notes.");
      if (use.use_id === "skeptic") throw new Error("The Skeptic is standing. It is not a declared use.");
      if (this.db.uses.filter((item) => item.user_id === userId).length >= 8) {
        throw new Error("Eight declared uses is the cap for this prototype.");
      }
      if (this.db.uses.some((item) => item.user_id === userId && item.use_id === use.use_id)) {
        throw new Error("You already declared that use.");
      }
      this.db.uses.push({ ...use, user_id: userId, description: use.description.trim(), taste_profile: use.taste_profile.trim() });
    });
  }

  createSource(source: SourceRecord): Promise<void> {
    return this.transaction(() => {
      if (source.url) {
        const key = normalizeBookmarkUrl(source.url);
        const duplicate = this.db.sources.find(
          (item) => item.user_id === source.user_id && item.url && key && normalizeBookmarkUrl(item.url) === key,
        );
        if (duplicate) throw new Error("You already saved this page. It is in your library.");
      }
      this.db.sources.push(source);
    });
  }

  getSource(userId: string, sourceId: string): Promise<SourceRecord | null> {
    return this.transaction(() => {
      const source = this.db.sources.find((item) => item.user_id === userId && item.source_id === sourceId);
      if (!source) return null;
      return { ...source, favicon_url: source.favicon_url ?? null, excerpted: Boolean(source.excerpted) };
    });
  }

  listSources(userId: string): Promise<SourceRecord[]> {
    return this.transaction(() =>
      this.db.sources
        .filter((source) => source.user_id === userId)
        .map((source) => ({ ...source, favicon_url: source.favicon_url ?? null, excerpted: Boolean(source.excerpted) }))
        .sort((a, b) => b.captured_at.localeCompare(a.captured_at)),
    );
  }

  findSourceByUrl(userId: string, url: string): Promise<SourceRecord | null> {
    const key = normalizeBookmarkUrl(url);
    if (!key) return Promise.resolve(null);
    return this.transaction(() => {
      return (
        this.db.sources.find(
          (source) => source.user_id === userId && source.url && normalizeBookmarkUrl(source.url) === key,
        ) ?? null
      );
    });
  }

  deleteSource(userId: string, sourceId: string): Promise<void> {
    return this.transaction(() => {
      const source = this.db.sources.find((item) => item.user_id === userId && item.source_id === sourceId);
      if (!source) throw new Error("That site is not in your library.");
      const runIds = new Set(this.db.runs.filter((run) => run.user_id === userId && run.source_id === sourceId).map((run) => run.id));
      this.db.sources = this.db.sources.filter((item) => item !== source);
      this.db.runs = this.db.runs.filter((run) => !runIds.has(run.id));
      this.db.proposals = this.db.proposals.filter((row) => !runIds.has(row.run_id));
      this.db.concepts = this.db.concepts.filter((row) => !runIds.has(row.run_id));
    });
  }

  createRun(run: RunRecord): Promise<void> {
    return this.transaction(() => {
      this.db.runs.push(run);
    });
  }

  updateRun(userId: string, runId: string, patch: Partial<RunRecord>): Promise<void> {
    return this.transaction(() => {
      const run = this.db.runs.find((item) => item.user_id === userId && item.id === runId);
      if (!run) throw new Error("Run not found");
      Object.assign(run, patch, { id: run.id, user_id: run.user_id });
    });
  }

  getRun(userId: string, runId: string): Promise<RunRecord | null> {
    return this.transaction(() => this.db.runs.find((run) => run.user_id === userId && run.id === runId) ?? null);
  }

  listRuns(userId: string): Promise<RunRecord[]> {
    return this.transaction(() =>
      this.db.runs.filter((run) => run.user_id === userId).sort((a, b) => b.started_at.localeCompare(a.started_at)),
    );
  }

  insertProposals(rows: ProposalRecord[]): Promise<void> {
    return this.transaction(() => {
      this.db.proposals.push(...rows);
    });
  }

  listProposals(userId: string, runId: string): Promise<ProposalRecord[]> {
    return this.transaction(() => this.db.proposals.filter((row) => row.user_id === userId && row.run_id === runId));
  }

  countNonSkeptic(userId: string): Promise<number> {
    return this.transaction(
      () => this.db.proposals.filter((row) => row.user_id === userId && row.role_id !== "skeptic" && row.status !== "dropped").length,
    );
  }

  insertConcepts(rows: ConceptRecord[]): Promise<void> {
    return this.transaction(() => {
      this.db.concepts.push(...rows);
    });
  }

  listConcepts(userId: string, runId: string): Promise<ConceptRecord[]> {
    return this.transaction(() => this.db.concepts.filter((row) => row.user_id === userId && row.run_id === runId));
  }

  insertCosts(rows: CostEvent[]): Promise<void> {
    return this.transaction(() => {
      this.db.costs.push(...rows);
    });
  }

  listCosts(userId: string): Promise<CostEvent[]> {
    return this.transaction(() =>
      this.db.costs.filter((row) => row.user_id === userId).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );
  }

  insertAudit(rows: AuditEntry[]): Promise<void> {
    return this.transaction(() => {
      this.db.audit.push(...rows);
    });
  }

  listAudit(userId: string): Promise<AuditEntry[]> {
    return this.transaction(() =>
      this.db.audit.filter((row) => row.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    );
  }

  acceptedHistory(userId: string): Promise<HistoryItem[]> {
    return this.transaction(() =>
      this.db.register
        .filter((entry) => entry.user_id === userId)
        .map((entry) => ({
          user_id: entry.user_id,
          status: "accepted" as const,
          id: entry.id,
          quote: entry.quote,
          judgment: entry.judgment,
          reasoning: entry.reasoning,
          decided_at: entry.decided_at,
          role_id: entry.role_id,
          source_id: entry.source_id,
        })),
    );
  }

  listRegister(userId: string): Promise<RegisterEntry[]> {
    return this.transaction(() =>
      this.db.register.filter((entry) => entry.user_id === userId).sort((a, b) => b.decided_at.localeCompare(a.decided_at)),
    );
  }

  searchRegister(userId: string, query: string): Promise<RegisterEntry[]> {
    return this.transaction(() => {
      const rows = this.db.register
        .filter((entry) => entry.user_id === userId)
        .sort((a, b) => b.decided_at.localeCompare(a.decided_at));
      const needle = query.trim();
      if (!needle) return rows;
      return rows.filter((entry) => matches(entry, needle));
    });
  }

  decide(args: {
    userId: string;
    proposalId: string;
    action: "accept" | "reject";
    reason: string;
    humanName: string;
    decidedAt?: string;
  }): Promise<DecideResult> {
    return this.transaction(() => {
      const proposal = this.db.proposals.find((row) => row.user_id === args.userId && row.proposal_id === args.proposalId);
      if (!proposal) throw new Error("Unauthorized user");
      if (proposal.status === "accepted" || proposal.status === "rejected") {
        if ((args.action === "accept" && proposal.status === "accepted") || (args.action === "reject" && proposal.status === "rejected")) {
          const existing = this.db.register.find((entry) => entry.user_id === args.userId && entry.proposal_id === proposal.proposal_id) ?? null;
          const audit = this.db.audit.find((entry) => entry.proposal_id === proposal.proposal_id && entry.kind === "rejection");
          return {
            status: proposal.status,
            runId: proposal.run_id,
            registerEntry: existing,
            audit: {
              proposal_id: proposal.proposal_id,
              user_id: args.userId,
              human_name: args.humanName,
              action: args.action,
              reason: audit?.summary ?? args.reason,
              decided_at: existing?.decided_at ?? new Date().toISOString(),
            },
          };
        }
        throw new Error("Decision already finalized");
      }
      if (proposal.status !== "pending") throw new Error("Decision already finalized");
      const decidedAt = args.decidedAt ?? new Date().toISOString();
      const result = applyDecision(
        proposal,
        {
          proposal_id: proposal.proposal_id,
          user_id: args.userId,
          human_name: args.humanName,
          action: args.action,
          reason: args.reason,
          decided_at: decidedAt,
        },
        args.userId,
        "pending",
      );
      proposal.status = result.status;
      let registerEntry: RegisterEntry | null = null;
      if (result.registerEntry) {
        const source = this.db.sources.find((item) => item.user_id === args.userId && item.source_id === proposal.source_id);
        registerEntry = {
          id: newId("reg"),
          user_id: args.userId,
          proposal_id: proposal.proposal_id,
          run_id: proposal.run_id,
          source_id: proposal.source_id,
          source_title: source?.title ?? proposal.source_id,
          source_version: proposal.source_version,
          quote: proposal.quote,
          paragraph_id: proposal.paragraph_id,
          judgment: proposal.judgment,
          reasoning: proposal.reasoning,
          role_id: proposal.role_id,
          use_id: proposal.use_id,
          model_id: proposal.model_id,
          prompt_version: proposal.prompt_version,
          human_name: args.humanName.trim(),
          reason: args.reason,
          decided_at: decidedAt,
        };
        this.db.register.push(registerEntry);
      } else {
        this.db.audit.push({
          id: newId("aud"),
          user_id: args.userId,
          run_id: proposal.run_id,
          kind: "rejection",
          summary: args.reason.trim() || "Rejected with no note.",
          proposal_id: proposal.proposal_id,
          created_at: decidedAt,
        });
      }
      return { status: result.status, runId: proposal.run_id, registerEntry, audit: result.audit };
    });
  }

  listChat(userId: string): Promise<ChatTurn[]> {
    return this.transaction(() => this.db.chat.filter((turn) => turn.user_id === userId));
  }

  addChat(turn: ChatTurn): Promise<void> {
    return this.transaction(() => {
      this.db.chat.push(turn);
    });
  }

  decisionCounts(userId: string): Promise<{ accepted: number; reviewed: number }> {
    return this.transaction(() => {
      const rows = this.db.proposals.filter((row) => row.user_id === userId && (row.status === "accepted" || row.status === "rejected"));
      return {
        accepted: rows.filter((row) => row.status === "accepted").length,
        reviewed: rows.length,
      };
    });
  }
}

const globalStore = globalThis as unknown as { __shannonStore?: MemoryStore };

export function getMemoryStore(): MemoryStore {
  if (!globalStore.__shannonStore) {
    const dir = process.env.SHANNON_DATA_DIR || path.join(process.cwd(), ".data");
    mkdirSync(dir, { recursive: true });
    globalStore.__shannonStore = new MemoryStore(path.join(dir, "store.json"));
  }
  return globalStore.__shannonStore;
}
