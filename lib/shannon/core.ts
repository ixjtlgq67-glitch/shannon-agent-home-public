/**
 * Deterministic checks ported from Team Shannon's `shannon_home/core.py`.
 * Authentication and durable transactions stay in the server store.
 * A model never accepts a proposal and never validates its own quotation.
 */
import {
  FrozenSourceSchema,
  HumanDecisionSchema,
  ProposalBatchSchema,
  type FrozenSource,
  type HistoryItem,
  type HumanDecision,
  type Proposal,
  type ProposalBatch,
} from "./types";

export function selectPanel(recommended: string[], declared: string[], remainingCalls: number): string[] {
  if (remainingCalls < 1) throw new Error("No budget for required Skeptic");
  const unique: string[] = [];
  for (const id of recommended) {
    if (!unique.includes(id)) unique.push(id);
  }
  for (const id of unique) {
    if (!declared.includes(id)) throw new Error("Undeclared use");
  }
  const take = Math.min(3, remainingCalls - 1);
  return ["skeptic", ...unique.slice(0, Math.max(0, take)).map((id) => `use:${id}`)];
}

export type ReviewPlan = {
  roles: string[];
  skipped: string[];
  includeConcept: boolean;
  plannedCalls: number;
};

/**
 * Server-enforced panel. Skeptic is reserved first. Declared uses that require
 * accepted history are skipped until the reader has one, so a later use can
 * take the open slot. Concept is a metadata call, not a judgment.
 */
export function planReview(args: {
  recommended: string[];
  declared: string[];
  requiresHistory: string[];
  hasHistory: boolean;
  callBudget: number;
  spentCalls: number;
}): ReviewPlan {
  const allowance = args.callBudget - args.spentCalls;
  if (allowance < 1) throw new Error("No budget for required Skeptic");
  const eligible: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const id of args.recommended) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (!args.hasHistory && args.requiresHistory.includes(id)) {
      skipped.push(`use:${id}`);
      continue;
    }
    eligible.push(id);
  }
  const reserveConcept = allowance > 1;
  const roleBudget = allowance - (reserveConcept ? 1 : 0);
  const roles = selectPanel(eligible, args.declared, roleBudget);
  return {
    roles,
    skipped,
    includeConcept: reserveConcept,
    plannedCalls: args.spentCalls + roles.length + (reserveConcept ? 1 : 0),
  };
}

export function proposalProblem(
  proposal: Proposal,
  source: FrozenSource,
  expected: { role: string; model: string; promptVersion: string; declaredUses: string[] },
): string | null {
  const ids = source.paragraphs.map((p) => p.id);
  if (new Set(ids).size !== ids.length) return "Duplicate paragraph locator";
  const paragraphs = new Map(source.paragraphs.map((p) => [p.id, p.text]));
  if (
    proposal.user_id !== source.user_id ||
    proposal.source_id !== source.source_id ||
    proposal.source_version !== source.source_version
  ) {
    return "Wrong user, source or frozen version";
  }
  if (
    proposal.role_id !== expected.role ||
    proposal.model_id !== expected.model ||
    proposal.prompt_version !== expected.promptVersion
  ) {
    return "Wrong runtime provenance";
  }
  const paragraph = paragraphs.get(proposal.paragraph_id);
  if (!proposal.quote.trim() || paragraph === undefined || !paragraph.includes(proposal.quote)) {
    return "Quote does not match its frozen paragraph";
  }
  if (!proposal.judgment.trim() || !proposal.reasoning.trim()) {
    return "Missing judgment or reasoning";
  }
  if (proposal.role_id === "skeptic") {
    if (proposal.use_id !== null || proposal.exploration) {
      return "Skeptic has no learned-use profile or exploration mode";
    }
  } else if (
    proposal.use_id === null ||
    !expected.declaredUses.includes(proposal.use_id) ||
    proposal.role_id !== `use:${proposal.use_id}`
  ) {
    return "Role does not match a declared use";
  }
  return null;
}

/** Accept a stored source that also carries title and capture metadata. */
export function asFrozenSource(sourceInput: unknown): FrozenSource {
  if (!sourceInput || typeof sourceInput !== "object") return FrozenSourceSchema.parse(sourceInput);
  const row = sourceInput as Partial<FrozenSource>;
  return FrozenSourceSchema.parse({
    user_id: row.user_id,
    source_id: row.source_id,
    source_version: row.source_version,
    paragraphs: row.paragraphs,
  });
}

/** Reject a malformed batch atomically. Exact quotation checks use no model. */
export function validateBatch(
  raw: unknown,
  sourceInput: unknown,
  expected: { role: string; model: string; promptVersion: string; declaredUses: string[] },
): Proposal[] {
  const batch = ProposalBatchSchema.parse(raw) as ProposalBatch;
  const source = asFrozenSource(sourceInput);
  const ids = source.paragraphs.map((p) => p.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate paragraph locator");
  if (batch.proposals.length > 2) throw new Error("More than two proposals for role");
  const seen = new Set<string>();
  for (const proposal of batch.proposals) {
    if (seen.has(proposal.proposal_id)) throw new Error("Duplicate proposal ID");
    seen.add(proposal.proposal_id);
    const problem = proposalProblem(proposal, source, expected);
    if (problem) throw new Error(problem);
  }
  return batch.proposals;
}

export type DroppedProposal = { proposal_id: string; reason: string };

/**
 * Product path: keep proposals whose quote and locator match the frozen
 * paragraph, and drop the rest. A bad sibling does not discard a good one.
 * At most two survivors per role.
 */
export function dropMismatches(
  raw: unknown,
  sourceInput: unknown,
  expected: { role: string; model: string; promptVersion: string; declaredUses: string[] },
): { kept: Proposal[]; dropped: DroppedProposal[] } {
  const batch = ProposalBatchSchema.parse(raw) as ProposalBatch;
  const source = asFrozenSource(sourceInput);
  const ids = source.paragraphs.map((p) => p.id);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate paragraph locator");
  const kept: Proposal[] = [];
  const dropped: DroppedProposal[] = [];
  const seen = new Set<string>();
  for (const proposal of batch.proposals) {
    if (seen.has(proposal.proposal_id)) {
      dropped.push({ proposal_id: proposal.proposal_id, reason: "Duplicate proposal ID" });
      continue;
    }
    seen.add(proposal.proposal_id);
    const problem = proposalProblem(proposal, source, expected);
    if (problem) {
      dropped.push({ proposal_id: proposal.proposal_id, reason: problem });
      continue;
    }
    if (kept.length >= 2) {
      dropped.push({ proposal_id: proposal.proposal_id, reason: "More than two proposals for role" });
      continue;
    }
    kept.push(proposal);
  }
  return { kept, dropped };
}

function judgmentKey(judgment: string): string {
  return judgment.split(/\s+/).filter(Boolean).join(" ");
}

/** Do not collapse differing judgments, use contexts, or Skeptic dissent. */
export function deduplicate(proposals: Proposal[]): Proposal[] {
  const result: Proposal[] = [];
  const seen = new Set<string>();
  const ids = new Set<string>();
  for (const proposal of proposals) {
    if (ids.has(proposal.proposal_id)) throw new Error("Duplicate proposal ID across batches");
    ids.add(proposal.proposal_id);
    const key = [
      proposal.user_id,
      proposal.source_id,
      proposal.source_version,
      proposal.role_id,
      proposal.use_id ?? "",
      proposal.paragraph_id,
      proposal.quote,
      judgmentKey(proposal.judgment),
    ].join("\u0000");
    if (!seen.has(key)) {
      result.push(proposal);
      seen.add(key);
    }
  }
  return result;
}

export function panelStatus(expectedRoles: string[], successfulRoles: string[]): "complete" | "incomplete" {
  const done = new Set(successfulRoles);
  return expectedRoles.every((role) => done.has(role)) ? "complete" : "incomplete";
}

export function applyDecision(
  proposal: Proposal,
  decisionInput: unknown,
  authenticatedUserId: string,
  currentStatus = "pending",
): { status: "accepted" | "rejected"; audit: HumanDecision; registerEntry: Proposal | null } {
  const decision = HumanDecisionSchema.parse(decisionInput) as HumanDecision;
  if (
    !authenticatedUserId ||
    proposal.user_id !== authenticatedUserId ||
    decision.user_id !== authenticatedUserId
  ) {
    throw new Error("Unauthorized user");
  }
  if (decision.proposal_id !== proposal.proposal_id) throw new Error("Wrong proposal");
  if (currentStatus !== "pending") throw new Error("Decision already finalized");
  if (!decision.human_name.trim()) throw new Error("Named human required");
  const status = decision.action === "accept" ? "accepted" : "rejected";
  return {
    status,
    audit: decision,
    registerEntry: status === "accepted" ? proposal : null,
  };
}

export function metrics(args: {
  accepted: number;
  reviewed: number;
  eventCosts: Array<number | null>;
}): {
  acceptance_rate: number | null;
  total_model_cost_usd: number | null;
  cost_per_accepted_judgment_usd: number | null;
} {
  const { accepted, reviewed, eventCosts } = args;
  if (accepted < 0 || reviewed < accepted || eventCosts.some((cost) => cost !== null && cost < 0)) {
    throw new Error("Invalid counts or costs");
  }
  const total = eventCosts.some((cost) => cost === null) ? null : eventCosts.reduce<number>((sum, cost) => sum + (cost ?? 0), 0);
  return {
    acceptance_rate: reviewed ? accepted / reviewed : null,
    total_model_cost_usd: total,
    cost_per_accepted_judgment_usd: accepted && total !== null ? total / accepted : null,
  };
}

export function sanitizeHistory(userId: string, records: unknown): HistoryItem[] {
  if (!Array.isArray(records)) throw new Error("Accepted history must be a list");
  return records.map((record) => {
    if (!record || typeof record !== "object") throw new Error("Unaccepted or unauthorized history");
    const item = record as Partial<HistoryItem>;
    if (!userId || item.user_id !== userId || item.status !== "accepted") {
      throw new Error("Unaccepted or unauthorized history");
    }
    return item as HistoryItem;
  });
}

/** Skeptic receives the source and accepted history, never a taste profile. */
export function prepareAgentContext(
  agentId: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const source = payload.source as { user_id?: string } | undefined;
  const user = source?.user_id ?? (typeof payload.authenticated_user_id === "string" ? payload.authenticated_user_id : "");
  for (const key of ["accepted_history", "accepted_judgments"] as const) {
    if (key in payload) sanitizeHistory(user, payload[key]);
  }
  if (agentId === "skeptic") {
    const next: Record<string, unknown> = {};
    for (const key of ["source", "accepted_history", "task", "runtime_provenance"]) {
      if (key in payload) next[key] = payload[key];
    }
    return next;
  }
  if (agentId === "role") {
    const use = payload.declared_use as { id?: string; description?: string } | undefined;
    if (!use || !use.id || !use.description) throw new Error("Declared-use role requires id and description");
  }
  return payload;
}

/** One kept non-Skeptic proposal in five is marked exploration. Skeptic never is. */
export function markExploration(proposals: Proposal[], priorNonSkeptic: number): { proposals: Proposal[]; nonSkeptic: number } {
  let count = priorNonSkeptic;
  const next = proposals.map((proposal) => {
    if (proposal.role_id === "skeptic") return { ...proposal, exploration: false };
    count += 1;
    return { ...proposal, exploration: count % 5 === 0 };
  });
  return { proposals: next, nonSkeptic: count };
}

export function roleLabel(roleId: string): string {
  if (roleId === "skeptic") return "Skeptic";
  const id = roleId.startsWith("use:") ? roleId.slice(4) : roleId;
  return id.slice(0, 1).toUpperCase() + id.slice(1);
}

export function canAffordCall(spentUsd: number, budgetUsd: number, reserveUsd: number): boolean {
  return spentUsd + reserveUsd <= budgetUsd + 1e-9;
}
