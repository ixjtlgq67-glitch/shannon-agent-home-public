import { randomBytes } from "crypto";
import type { FrozenSource, HistoryItem, Proposal, ProposalBatch } from "./types";
import { DEMO_MODEL_ID } from "./pricing";

const PROMPT_VERSION = "1.0.0";

function id(prefix: string): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

/** An exact substring of a frozen paragraph. */
export function verbatimExcerpt(text: string, which: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 200) return clean;
  const sentences = clean.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.length >= 24);
  const sentence = sentences.length ? sentences[which % sentences.length] : clean;
  if (sentence.length <= 220) return sentence;
  const slice = sentence.slice(0, 180);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > 40 ? slice.slice(0, lastSpace) : slice;
  if (!clean.includes(cut)) throw new Error("Excerpt was not a substring");
  return cut;
}

function paragraphAt(source: FrozenSource, index: number) {
  return source.paragraphs[index % source.paragraphs.length];
}

export function mockRoleBatch(args: {
  source: FrozenSource;
  roleId: string;
  useId: string | null;
  history: HistoryItem[];
  poison?: boolean;
}): ProposalBatch {
  const first = paragraphAt(args.source, 0);
  const second = paragraphAt(args.source, 1);
  const prior = args.history[0];
  const lens = args.roleId === "skeptic" ? "skeptic" : (args.useId ?? "use");
  const judgments: Record<string, [string, string]> = {
    skeptic: [
      "This sentence is being asked to carry more than it says. The quotation supports a limited claim, and the rest is inference.",
      "I would not accept a broader conclusion from this paragraph alone. The locator shows the evidence, and it does not show an unmeasured result.",
    ],
    practitioner: [
      "A practitioner can act on this paragraph: it names a step, a constraint, or a consequence in the work itself.",
      "Keep this if you are preparing a session. It is a passage you could hand someone and ask them to use.",
    ],
    economist: [
      "Read this for cost, incentives, or what was left unpriced. Do not add a number the paragraph does not contain.",
      "An economist should ask who bears the cost of being wrong here. The quotation is the only evidence offered.",
    ],
    historian: [
      prior
        ? `Set this beside the accepted judgment ${prior.id}. The new paragraph either extends that reasoning or qualifies it.`
        : "This would belong next to an earlier acceptance, and there is not one yet.",
      "The value of this paragraph is how it changes a judgment already kept, not how it stands as a new tag.",
    ],
  };
  const pair = judgments[lens] ?? judgments.practitioner;
  const reasons: Record<string, string> = {
    skeptic: "The Skeptic stays outside learned taste and only challenges what the frozen paragraph can support.",
    practitioner: "The declared use asks what a practitioner can do with the passage.",
    economist: "The declared use asks what the passage implies for cost and incentives.",
    historian: prior
      ? `Accepted history ${prior.id} is the comparison, and the quotation itself is from this frozen source.`
      : "Historian has no accepted history to compare.",
  };
  const proposals: Proposal[] = [
    {
      proposal_id: id("pr"),
      user_id: args.source.user_id,
      source_id: args.source.source_id,
      source_version: args.source.source_version,
      quote: verbatimExcerpt(first.text, 0),
      paragraph_id: first.id,
      judgment: pair[0],
      reasoning: reasons[lens] ?? reasons.practitioner,
      role_id: args.roleId,
      use_id: args.useId,
      model_id: DEMO_MODEL_ID,
      prompt_version: PROMPT_VERSION,
      exploration: false,
    },
    {
      proposal_id: id("pr"),
      user_id: args.source.user_id,
      source_id: args.source.source_id,
      source_version: args.source.source_version,
      quote: verbatimExcerpt(second.text, 1),
      paragraph_id: second.id,
      judgment: pair[1],
      reasoning: "A second proposal must be a different judgment, still tied to one paragraph.",
      role_id: args.roleId,
      use_id: args.useId,
      model_id: DEMO_MODEL_ID,
      prompt_version: PROMPT_VERSION,
      exploration: false,
    },
  ];
  if (args.poison) {
    proposals.unshift({
      ...proposals[0],
      proposal_id: id("pr"),
      quote: "This quotation was not in the frozen source.",
      judgment: "This proposal exists so the server can drop a mismatch.",
      reasoning: "The quotation is fabricated and must not be shown as pending.",
    });
  }
  return {
    proposals,
    limitations: ["Canned demo output. No model generated these records."],
  };
}

export function mockTriage(useIds: string[], readable: boolean) {
  if (!readable) {
    return {
      readable: false,
      recommendations: [],
      limitations: ["The capture did not produce a readable paragraph."],
    };
  }
  return {
    readable: true,
    recommendations: useIds.map((useId) => ({
      use_id: useId,
      reason: `You declared ${useId}, and the frozen source has a paragraph a reader can quote.`,
    })),
    limitations: [] as string[],
  };
}

export function mockConductorPlan(selected: string[], skipped: string[], plannedCalls: number) {
  return {
    selected_use_ids: selected.filter((role) => role.startsWith("use:")).map((role) => role.slice(4)).slice(0, 3),
    include_skeptic: true as const,
    include_concept: plannedCalls > 0,
    planned_model_calls: Math.max(1, plannedCalls),
    retry_role_ids: [] as string[],
    skipped_use_ids: skipped,
    rationale: "Server code reserves the Skeptic, caps the panel at four roles, and skips uses that still have no accepted history.",
  };
}

export function mockConcepts(source: FrozenSource, useIds: string[]) {
  const paragraph = source.paragraphs[0];
  return {
    concepts: [
      {
        name: "quoted claim",
        use_ids: useIds,
        paragraph_id: paragraph.id,
        reason: "A label for the opening paragraph. It is metadata, not a judgment.",
      },
    ],
    limitations: ["Concepts do not enter the register."],
  };
}

export const MOCK_USAGE: Record<string, { input: number; output: number; latencyMs: number }> = {
  triage: { input: 840, output: 110, latencyMs: 42 },
  "product-conductor": { input: 610, output: 96, latencyMs: 28 },
  skeptic: { input: 1180, output: 260, latencyMs: 55 },
  role: { input: 1240, output: 310, latencyMs: 61 },
  concept: { input: 720, output: 84, latencyMs: 24 },
  chatbot: { input: 980, output: 240, latencyMs: 48 },
};
