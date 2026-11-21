import { randomBytes } from "crypto";
import { ZodError } from "zod";
import { isLiveModels, itemCallBudget, itemUsdBudget, roleTimeoutMs } from "@/lib/config";
import type { ProductStore, CostEvent, ProposalRecord } from "@/lib/store/types";
import { canAffordCall, deduplicate, dropMismatches, markExploration, panelStatus, planReview, prepareAgentContext } from "./core";
import {
  coerceUrl,
  fetchPublicText,
  freezeParagraphs,
  isReadable,
  looksPaywalled,
  normalizeBookmarkUrl,
  pageFavicon,
  pageTitle,
  readArticle,
  sourceVersion,
  splitPasted,
} from "./freeze";
import {
  ConceptResultSchema,
  ConductorPlanSchema,
  ProposalBatchSchema,
  TriageResultSchema,
  type DeclaredUse,
  type FrozenSource,
  type HistoryItem,
  type Proposal,
} from "./types";
import { definition } from "./registry";
import { DEMO_MODEL_ID, estimateCostUsd, priceVersionFor, reserveUsd } from "./pricing";
import { MOCK_USAGE, mockConcepts, mockConductorPlan, mockRoleBatch, mockTriage } from "./mock-agents";

function nid(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

type SessionUser = { id: string; displayName: string };

export type CaptureResult = { runId: string } | { error: string };

function siteHost(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function logCall(
  store: ProductStore,
  event: Omit<CostEvent, "id" | "created_at">,
): Promise<CostEvent> {
  const row: CostEvent = { ...event, id: nid("cost"), created_at: new Date().toISOString() };
  await store.insertCosts([row]);
  return row;
}

function spentUsd(events: CostEvent[]): number {
  return events.reduce((sum, event) => sum + (event.estimated_cost_usd ?? 0), 0);
}

export async function captureAndRun(args: {
  user: SessionUser;
  store: ProductStore;
  title: string;
  url: string | null;
  text: string;
  /** When the reader can already see the page, keep their text instead of fetching a blocked copy. */
  preferSuppliedText?: boolean;
  favicon?: string | null;
}): Promise<CaptureResult> {
  const requestedUrl = args.url ? coerceUrl(args.url) : "";
  if (requestedUrl) {
    const existing = await args.store.findSourceByUrl(args.user.id, requestedUrl);
    if (existing) {
      const runs = await args.store.listRuns(args.user.id);
      const run = runs.find((item) => item.source_id === existing.source_id);
      if (run) return { runId: run.id };
      return { error: "You already saved this page. It is in your library." };
    }
  }
  let origin: "url" | "paste" = "paste";
  let finalUrl: string | null = requestedUrl || null;
  let chunks: string[] = [];
  let excerpted = false;
  let faviconUrl: string | null = null;
  let extractedTitle: string | null = null;
  let fetchError: string | null = null;
  const supplied = Boolean(args.preferSuppliedText && args.text.trim().length >= 40);
  if (supplied) {
    chunks = splitPasted(args.text);
    origin = requestedUrl ? "url" : "paste";
    faviconUrl = args.favicon ?? null;
    extractedTitle = args.title.trim() || null;
  } else if (requestedUrl) {
    try {
      const fetched = await fetchPublicText(requestedUrl);
      finalUrl = fetched.finalUrl;
      extractedTitle = pageTitle(fetched.body);
      faviconUrl = pageFavicon(fetched.body, fetched.finalUrl);
      const article = readArticle(fetched.body);
      const candidate = freezeParagraphs(article.chunks);
      if (looksPaywalled(fetched.body) && candidate.length < 2) {
        fetchError = "This page is behind a wall Shannon cannot pass. Paste the passage you want judged.";
      } else if (!isReadable(candidate)) {
        fetchError = "Shannon could not read the article text on this page. Paste the passage you want judged.";
      } else {
        chunks = article.chunks;
        excerpted = article.excerpted;
        origin = "url";
      }
    } catch (error) {
      fetchError = error instanceof Error ? error.message : "The page could not be read. Paste the passage you want judged.";
    }
  }
  if (!chunks.length && args.text.trim().length >= 40) {
    chunks = splitPasted(args.text);
    origin = "paste";
    excerpted = false;
    fetchError = null;
  } else if (!chunks.length) {
    return { error: fetchError ?? "Paste the passage, or give a URL Shannon can read." };
  }
  const paragraphs = freezeParagraphs(chunks);
  if (!isReadable(paragraphs)) {
    return { error: fetchError ?? "Shannon could not find a readable paragraph. Paste the passage you want judged." };
  }
  const title =
    args.title.trim().slice(0, 180) ||
    extractedTitle ||
    (finalUrl ? siteHost(finalUrl) : "");
  if (!title) return { error: "Give the bookmark a title you will recognize later." };
  const source: FrozenSource & {
    title: string;
    url: string | null;
    origin: "url" | "paste";
    captured_at: string;
    favicon_url: string | null;
    excerpted: boolean;
  } = {
    user_id: args.user.id,
    source_id: nid("src"),
    source_version: sourceVersion(paragraphs),
    paragraphs,
    title,
    url: finalUrl,
    origin,
    captured_at: new Date().toISOString(),
    favicon_url: faviconUrl,
    excerpted,
  };
  try {
    await args.store.createSource(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("already saved") && finalUrl) {
      const existing = await args.store.findSourceByUrl(args.user.id, finalUrl);
      const runs = await args.store.listRuns(args.user.id);
      const run = existing && runs.find((item) => item.source_id === existing.source_id);
      if (run) return { runId: run.id };
    }
    throw error;
  }
  try {
    const { serviceUpload } = await import("@/lib/store/storage");
    await serviceUpload(source);
  } catch {
    await args.store.insertAudit([
      {
        id: nid("aud"),
        user_id: args.user.id,
        run_id: null,
        kind: "storage",
        summary: "Frozen paragraphs are in the database. The private storage copy was not written.",
        proposal_id: null,
        created_at: new Date().toISOString(),
      },
    ]);
  }
  const runId = await runPanel({ userId: args.user.id, store: args.store, source });
  return { runId };
}

export async function runPanel(args: { userId: string; store: ProductStore; source: FrozenSource }): Promise<string> {
  const store = args.store;
  const uses = (await store.listUses(args.userId)).filter((use) => use.enabled);
  const history = await store.acceptedHistory(args.userId);
  const callBudget = itemCallBudget();
  const usdBudget = itemUsdBudget();
  const runId = nid("run");
  const costs: CostEvent[] = [];
  let callsUsed = 0;
  const live = isLiveModels();
  const cannedModel = live ? undefined : DEMO_MODEL_ID;

  await store.createRun({
    id: runId,
    user_id: args.userId,
    source_id: args.source.source_id,
    status: "incomplete",
    planned_roles: [],
    successful_roles: [],
    failed_roles: [],
    skipped_roles: [],
    call_budget: callBudget,
    calls_used: 0,
    usd_budget: usdBudget,
    started_at: new Date().toISOString(),
    finished_at: null,
  });

  const budgetBlocked = () => !canAffordCall(spentUsd(costs), usdBudget, live ? reserveUsd(process.env.SHANNON_MODEL || "gpt-4.1-mini") : 0.00001);

  const triage = await callAgent({
    store,
    costs,
    live,
    userId: args.userId,
    runId,
    agentId: "triage",
    allow: callsUsed < callBudget && !budgetBlocked(),
    payload: {
      source: args.source,
      declared_uses: uses.map((use) => ({ id: use.use_id, description: use.description })),
      task: "Recommend only these declared use ids. Do not invent uses.",
    },
    fallback: () => mockTriage(uses.map((use) => use.use_id), true),
    schemaName: "triage",
  });
  if (triage.logged) callsUsed += 1;

  let recommended = uses.map((use) => use.use_id);
  if (triage.output) {
    const parsed = TriageResultSchema.safeParse(triage.output);
    if (parsed.success) {
      const declared = new Set(uses.map((use) => use.use_id));
      recommended = parsed.data.recommendations.map((item) => item.use_id).filter((id) => declared.has(id));
    }
  }

  const conductorPayloadBase = {
    recommended,
    declared: uses.map((use) => use.use_id),
    requiresHistory: uses.filter((use) => use.requires_history).map((use) => use.use_id),
    hasHistory: history.length > 0,
    callBudget,
    spentCalls: callsUsed + 1,
  };

  let plan = safePlan(conductorPayloadBase);
  const conductor = await callAgent({
    store,
    costs,
    live,
    userId: args.userId,
    runId,
    agentId: "product-conductor",
    allow: callsUsed < callBudget && !budgetBlocked() && plan !== null,
    payload: {
      triage_recommendations: recommended,
      declared_uses: uses.map((use) => ({ id: use.use_id, description: use.description, requires_history: use.requires_history })),
      remaining_calls: callBudget - callsUsed,
      has_accepted_history: history.length > 0,
      task: "Propose a plan. Server code will enforce the Skeptic, the four-role cap, and the history gate.",
    },
    fallback: () =>
      plan
        ? mockConductorPlan(plan.roles, plan.skipped, plan.plannedCalls)
        : mockConductorPlan(["skeptic"], [], 1),
    schemaName: "conductor",
  });
  if (conductor.logged) callsUsed += 1;

  const enforced = safePlan({ ...conductorPayloadBase, spentCalls: callsUsed });
  if (enforced) {
    const parsed = ConductorPlanSchema.safeParse(conductor.output);
    if (parsed.success && parsed.data.selected_use_ids.length) {
      const allow = new Set(parsed.data.selected_use_ids.map((id) => `use:${id}`));
      const omitted = enforced.roles.filter((role) => role !== "skeptic" && !allow.has(role));
      const narrowed = enforced.roles.filter((role) => role === "skeptic" || allow.has(role));
      if (narrowed.length) {
        enforced.roles = narrowed;
        enforced.skipped = [...enforced.skipped, ...omitted];
      }
    }
    plan = enforced;
  }

  if (!plan) {
    await store.updateRun(args.userId, runId, {
      status: "incomplete",
      calls_used: callsUsed,
      finished_at: new Date().toISOString(),
      failed_roles: [{ role_id: "skeptic", reason: "No budget for required Skeptic" }],
    });
    await store.insertAudit([
      {
        id: nid("aud"),
        user_id: args.userId,
        run_id: runId,
        kind: "budget",
        summary: "The item budget could not cover the Skeptic, so no proposals were shown.",
        proposal_id: null,
        created_at: new Date().toISOString(),
      },
    ]);
    return runId;
  }

  await store.updateRun(args.userId, runId, {
    planned_roles: plan.roles,
    skipped_roles: plan.skipped,
    calls_used: callsUsed,
  });

  const priorNonSkeptic = await store.countNonSkeptic(args.userId);
  const outcomes = await Promise.all(plan.roles.map((roleId) => runRole({ roleId, uses, history, source: args.source, store, costs, live, userId: args.userId, runId, callBudget, usdBudget, callsUsedRef: () => callsUsed })));
  callsUsed += outcomes.filter((outcome) => outcome.calls).length;

  const failed = outcomes.filter((outcome) => !outcome.ok);
  for (const outcome of failed) {
    if (callsUsed >= callBudget || budgetBlocked()) break;
    const retry = await runRole({
      roleId: outcome.roleId,
      uses,
      history,
      source: args.source,
      store,
      costs,
      live,
      userId: args.userId,
      runId,
      callBudget,
      usdBudget,
      callsUsedRef: () => callsUsed,
      retryOf: outcome.costId,
    });
    callsUsed += retry.calls;
    const index = outcomes.findIndex((item) => item.roleId === outcome.roleId);
    outcomes[index] = retry;
  }

  const successful = outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.roleId);
  const failures = outcomes.filter((outcome) => !outcome.ok).map((outcome) => ({ role_id: outcome.roleId, reason: outcome.reason || "failed" }));

  const kept: Proposal[] = [];
  const droppedAudit: Array<{ proposal_id: string; reason: string; role: string }> = [];
  for (const outcome of outcomes) {
    if (!outcome.ok || !outcome.batch) continue;
    const roleId = outcome.roleId;
    const useId = roleId.startsWith("use:") ? roleId.slice(4) : null;
    try {
      const parted = dropMismatches(outcome.batch, args.source, {
        role: roleId,
        model: outcome.modelId || cannedModel || DEMO_MODEL_ID,
        promptVersion: outcome.promptVersion || "1.0.0",
        declaredUses: useId ? [useId] : [],
      });
      kept.push(...parted.kept);
      for (const drop of parted.dropped) droppedAudit.push({ ...drop, role: roleId });
    } catch (error) {
      const reason =
        error instanceof ZodError
          ? "The batch did not match the proposal contract."
          : error instanceof Error
            ? error.message.slice(0, 240)
            : "The batch could not be checked against the frozen source.";
      failures.push({ role_id: roleId, reason });
      const done = successful.indexOf(roleId);
      if (done >= 0) successful.splice(done, 1);
    }
  }

  let deduped: Proposal[] = [];
  try {
    deduped = deduplicate(kept);
  } catch {
    deduped = [];
    failures.push({ role_id: "conductor", reason: "Duplicate proposal ids collided across roles." });
  }
  const marked = markExploration(deduped, priorNonSkeptic);
  const now = new Date().toISOString();
  const rows: ProposalRecord[] = marked.proposals.slice(0, 8).map((proposal) => ({
    ...proposal,
    run_id: runId,
    status: "pending",
    drop_reason: null,
    created_at: now,
  }));
  if (rows.length) await store.insertProposals(rows);
  if (droppedAudit.length) {
    await store.insertAudit(
      droppedAudit.map((drop) => ({
        id: nid("aud"),
        user_id: args.userId,
        run_id: runId,
        kind: "quote_dropped" as const,
        summary: `${drop.role}: ${drop.reason}`,
        proposal_id: drop.proposal_id,
        created_at: now,
      })),
    );
  }
  if (failures.length) {
    await store.insertAudit(
      failures.map((failure) => ({
        id: nid("aud"),
        user_id: args.userId,
        run_id: runId,
        kind: "role_failed" as const,
        summary: `${failure.role_id} did not finish (${failure.reason}).`,
        proposal_id: null,
        created_at: now,
      })),
    );
  }

  if (plan.includeConcept && callsUsed < callBudget && !budgetBlocked()) {
    const concept = await callAgent({
      store,
      costs,
      live,
      userId: args.userId,
      runId,
      agentId: "concept",
      allow: true,
      payload: {
        source: args.source,
        declared_uses: uses.map((use) => use.use_id),
        task: "Emit concept labels only. They are not judgments.",
      },
      fallback: () => mockConcepts(args.source, uses.map((use) => use.use_id)),
      schemaName: "concept",
    });
    if (concept.logged) callsUsed += 1;
    const parsed = ConceptResultSchema.safeParse(concept.output);
    if (parsed.success) {
      await store.insertConcepts(
        parsed.data.concepts.slice(0, 6).map((conceptRow) => ({
          ...conceptRow,
          id: nid("con"),
          user_id: args.userId,
          run_id: runId,
        })),
      );
    }
  }

  const status = panelStatus(plan.roles, successful);
  await store.updateRun(args.userId, runId, {
    status,
    successful_roles: successful,
    failed_roles: failures,
    calls_used: callsUsed,
    finished_at: new Date().toISOString(),
  });
  return runId;
}

function safePlan(args: Parameters<typeof planReview>[0]) {
  try {
    return planReview(args);
  } catch {
    return null;
  }
}

async function callAgent(args: {
  store: ProductStore;
  costs: CostEvent[];
  live: boolean;
  userId: string;
  runId: string;
  agentId: string;
  allow: boolean;
  payload: Record<string, unknown>;
  fallback: () => unknown;
  schemaName: "triage" | "conductor" | "concept";
}): Promise<{ output: unknown; logged: boolean }> {
  if (!args.allow) return { output: args.live ? null : args.fallback(), logged: false };
  const promptVersion = definition(args.agentId).prompt_version;
  if (!args.live) {
    const usage = MOCK_USAGE[args.agentId] ?? MOCK_USAGE.triage;
    const row = await logCall(args.store, {
      user_id: args.userId,
      run_id: args.runId,
      agent_id: args.agentId,
      model_id: DEMO_MODEL_ID,
      prompt_version: promptVersion,
      status: "ok",
      input_tokens: usage.input,
      output_tokens: usage.output,
      estimated_cost_usd: estimateCostUsd(DEMO_MODEL_ID, usage.input, usage.output),
      price_version: priceVersionFor(DEMO_MODEL_ID),
      latency_ms: usage.latencyMs,
      retry_of: null,
    });
    args.costs.push(row);
    return { output: args.fallback(), logged: true };
  }
  const started = Date.now();
  try {
    const { runStructured } = await import("./live-agents");
    const schema =
      args.schemaName === "triage" ? TriageResultSchema : args.schemaName === "conductor" ? ConductorPlanSchema : ConceptResultSchema;
    const call = await withTimeout(runStructured(args.agentId, schema, args.payload), roleTimeoutMs());
    const row = await logCall(args.store, {
      user_id: args.userId,
      run_id: args.runId,
      agent_id: args.agentId,
      model_id: call.modelId,
      prompt_version: call.promptVersion,
      status: "ok",
      input_tokens: call.inputTokens,
      output_tokens: call.outputTokens,
      estimated_cost_usd: estimateCostUsd(call.modelId, call.inputTokens, call.outputTokens),
      price_version: priceVersionFor(call.modelId),
      latency_ms: call.latencyMs,
      retry_of: null,
    });
    args.costs.push(row);
    return { output: call.output, logged: true };
  } catch (error) {
    const timedOut = error instanceof Error && error.message === "timeout";
    const row = await logCall(args.store, {
      user_id: args.userId,
      run_id: args.runId,
      agent_id: args.agentId,
      model_id: process.env.SHANNON_MODEL || "gpt-4.1-mini",
      prompt_version: promptVersion,
      status: timedOut ? "timeout" : "error",
      input_tokens: null,
      output_tokens: null,
      estimated_cost_usd: null,
      price_version: null,
      latency_ms: Date.now() - started,
      retry_of: null,
    });
    args.costs.push(row);
    return { output: null, logged: true };
  }
}

async function runRole(args: {
  roleId: string;
  uses: DeclaredUse[];
  history: HistoryItem[];
  source: FrozenSource;
  store: ProductStore;
  costs: CostEvent[];
  live: boolean;
  userId: string;
  runId: string;
  callBudget: number;
  usdBudget: number;
  callsUsedRef: () => number;
  retryOf?: string | null;
}): Promise<{ roleId: string; ok: boolean; reason?: string; batch?: unknown; modelId?: string; promptVersion?: string; calls: number; costId: string | null }> {
  const live = args.live;
  const reserve = live ? reserveUsd(process.env.SHANNON_MODEL || "gpt-4.1-mini") : 0.00001;
  if (args.callsUsedRef() >= args.callBudget || !canAffordCall(spentUsd(args.costs), args.usdBudget, reserve)) {
    return { roleId: args.roleId, ok: false, reason: "budget", calls: 0, costId: null };
  }
  const useId = args.roleId.startsWith("use:") ? args.roleId.slice(4) : null;
  const use = args.uses.find((item) => item.use_id === useId);
  const agentId = args.roleId === "skeptic" ? "skeptic" : "role";
  const promptVersion = definition(agentId).prompt_version;
  const modelId = live ? process.env.SHANNON_MODEL || "gpt-4.1-mini" : DEMO_MODEL_ID;
  const basePayload: Record<string, unknown> = {
    source: args.source,
    accepted_history: args.history,
    task: "Return at most two proposals. Each quote must be an exact substring of one frozen paragraph, and paragraph_id must be that paragraph's id.",
    runtime_provenance: { model_id: modelId, prompt_version: promptVersion, role_id: args.roleId },
  };
  if (agentId === "role" && use) {
    basePayload.declared_use = { id: use.use_id, description: use.description };
    basePayload.taste_profile = use.taste_profile;
    basePayload.exploration = false;
  }
  let payload: Record<string, unknown>;
  try {
    payload = prepareAgentContext(agentId, basePayload);
  } catch (error) {
    return { roleId: args.roleId, ok: false, reason: error instanceof Error ? error.message : "context", calls: 0, costId: null };
  }

  const started = Date.now();
  try {
    let batch: unknown;
    let inputTokens: number | null;
    let outputTokens: number | null;
    let latency = MOCK_USAGE[agentId]?.latencyMs ?? 40;
    let usedModel = modelId;
    let usedPrompt = promptVersion;
    const slowRole = process.env.SHANNON_TEST_SLOW_ROLE;
    if (!live && slowRole && args.roleId === slowRole) {
      await withTimeout(new Promise((resolve) => setTimeout(resolve, roleTimeoutMs() + 40)), roleTimeoutMs());
    }
    if (!live) {
      const usage = MOCK_USAGE[agentId] ?? MOCK_USAGE.role;
      inputTokens = usage.input;
      outputTokens = usage.output;
      batch = mockRoleBatch({
        source: args.source,
        roleId: args.roleId,
        useId,
        history: args.history,
        poison: args.roleId === "skeptic" && !args.retryOf,
      });
    } else {
      const { runStructured } = await import("./live-agents");
      const call = await withTimeout(runStructured(agentId, ProposalBatchSchema, payload), roleTimeoutMs());
      batch = call.output;
      inputTokens = call.inputTokens;
      outputTokens = call.outputTokens;
      latency = call.latencyMs;
      usedModel = call.modelId;
      usedPrompt = call.promptVersion;
    }
    const row = await logCall(args.store, {
      user_id: args.userId,
      run_id: args.runId,
      agent_id: agentId,
      model_id: usedModel,
      prompt_version: usedPrompt,
      status: "ok",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: estimateCostUsd(usedModel, inputTokens, outputTokens),
      price_version: priceVersionFor(usedModel),
      latency_ms: latency,
      retry_of: args.retryOf ?? null,
    });
    args.costs.push(row);
    return { roleId: args.roleId, ok: true, batch, modelId: usedModel, promptVersion: usedPrompt, calls: 1, costId: row.id };
  } catch (error) {
    const timedOut = error instanceof Error && error.message === "timeout";
    const row = await logCall(args.store, {
      user_id: args.userId,
      run_id: args.runId,
      agent_id: agentId,
      model_id: modelId,
      prompt_version: promptVersion,
      status: timedOut ? "timeout" : "error",
      input_tokens: null,
      output_tokens: null,
      estimated_cost_usd: null,
      price_version: null,
      latency_ms: Date.now() - started,
      retry_of: args.retryOf ?? null,
    });
    args.costs.push(row);
    return {
      roleId: args.roleId,
      ok: false,
      reason: timedOut ? "timed out" : "error",
      calls: 1,
      costId: row.id,
    };
  }
}
