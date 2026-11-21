import { isLiveModels } from "@/lib/config";
import { prepareAgentContext } from "./core";
import { runStructured } from "./live-agents";
import { DEMO_MODEL_ID, estimateCostUsd, priceVersionFor } from "./pricing";
import { MOCK_USAGE } from "./mock-agents";
import { GroundedTextSchema, type GroundedText, type HistoryItem } from "./types";

export type CitationSource = {
  id: string;
  user_id: string;
  status: "accepted";
  quote: string;
  judgment: string;
  reasoning: string;
  decided_at: string;
  role_id: string;
  source_id: string;
  paragraph_id: string;
  source_title: string;
};

export type CheckedAnswer = GroundedText & {
  citations: Array<{ id: string; quote: string; judgment: string }>;
  model_id: string;
  prompt_version: string;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost_usd: number | null;
  price_version: string | null;
  latency_ms: number;
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function retrieve(question: string, entries: CitationSource[]): CitationSource[] {
  const terms = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 3);
  const scored = entries.map((entry) => {
    const haystack = `${entry.judgment} ${entry.quote} ${entry.reasoning} ${entry.role_id} ${entry.source_title}`.toLowerCase();
    const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
    return { entry, score };
  });
  scored.sort((a, b) => b.score - a.score || b.entry.decided_at.localeCompare(a.entry.decided_at));
  const matched = scored.filter((row) => row.score > 0).slice(0, 6).map((row) => row.entry);
  return matched.length ? matched : entries.slice(0, 4);
}

function mockAnswer(question: string, entries: CitationSource[]): GroundedText {
  if (!entries.length) {
    return {
      title: "Nothing accepted yet",
      statements: [],
      gaps: ["The register has no accepted judgments, so there is nothing to answer from."],
    };
  }
  return {
    title: "From your accepted register",
    statements: entries.slice(0, 3).map((entry) => ({
      text: `${entry.judgment} You accepted this on ${formatWhen(entry.decided_at)} from ${entry.source_title}, paragraph ${entry.paragraph_id}. The words were: “${entry.quote}”.`,
      accepted_judgment_ids: [entry.id],
    })),
    gaps:
      entries.length === 0
        ? ["No accepted judgment matched that question."]
        : [`This answer uses accepted judgments only. It does not reopen the saved source to add a new claim about “${question.slice(0, 80)}”.`],
  };
}

function quotedSpans(text: string): string[] {
  const spans: string[] = [];
  for (const match of text.matchAll(/“([^”]{20,})”|"([^"]{20,})"/g)) {
    spans.push(match[1] || match[2]);
  }
  return spans;
}

/** Drop any sentence that cites an id outside the authorized register, or quotes words it does not contain. */
export function checkGrounded(raw: unknown, authorized: CitationSource[]): GroundedText {
  const parsed = GroundedTextSchema.parse(raw);
  const byId = new Map(authorized.map((entry) => [entry.id, entry]));
  const statements = [];
  const gaps = [...parsed.gaps];
  for (const statement of parsed.statements) {
    const ids = statement.accepted_judgment_ids;
    if (!ids.length || ids.some((id) => !byId.has(id))) {
      gaps.push("A sentence was removed because it did not cite one of your accepted judgments.");
      continue;
    }
    const blob = ids
      .map((id) => {
        const entry = byId.get(id)!;
        return `${entry.quote}\n${entry.judgment}\n${entry.reasoning}`;
      })
      .join("\n");
    if (quotedSpans(statement.text).some((span) => !blob.includes(span))) {
      gaps.push("A sentence was removed because a quotation was not in the accepted judgment it cited.");
      continue;
    }
    statements.push(statement);
  }
  return { title: parsed.title, statements, gaps };
}

export async function answerFromRegister(args: {
  userId: string;
  question: string;
  entries: CitationSource[];
}): Promise<CheckedAnswer> {
  const picked = retrieve(args.question, args.entries);
  const history: HistoryItem[] = picked.map((entry) => ({
    user_id: entry.user_id,
    status: "accepted",
    id: entry.id,
    quote: entry.quote,
    judgment: entry.judgment,
    reasoning: entry.reasoning,
    decided_at: entry.decided_at,
    role_id: entry.role_id,
    source_id: entry.source_id,
  }));
  const payload = prepareAgentContext("chatbot", {
    authenticated_user_id: args.userId,
    question: args.question,
    accepted_judgments: history,
    task: "Answer only from accepted_judgments. Cite their ids. If they do not support an answer, say so in gaps.",
  });

  if (!isLiveModels()) {
    const usage = MOCK_USAGE.chatbot;
    const grounded = checkGrounded(mockAnswer(args.question, picked), picked);
    return {
      ...grounded,
      citations: grounded.statements.flatMap((statement) =>
        statement.accepted_judgment_ids.map((id) => {
          const entry = picked.find((item) => item.id === id)!;
          return { id, quote: entry.quote, judgment: entry.judgment };
        }),
      ),
      model_id: DEMO_MODEL_ID,
      prompt_version: "1.0.0",
      input_tokens: usage.input,
      output_tokens: usage.output,
      estimated_cost_usd: estimateCostUsd(DEMO_MODEL_ID, usage.input, usage.output),
      price_version: priceVersionFor(DEMO_MODEL_ID),
      latency_ms: usage.latencyMs,
    };
  }

  try {
    const call = await runStructured("chatbot", GroundedTextSchema, payload);
    const grounded = checkGrounded(call.output, picked);
    return {
      ...grounded,
      citations: grounded.statements.flatMap((statement) =>
        statement.accepted_judgment_ids.map((id) => {
          const entry = picked.find((item) => item.id === id)!;
          return { id, quote: entry.quote, judgment: entry.judgment };
        }),
      ),
      model_id: call.modelId,
      prompt_version: call.promptVersion,
      input_tokens: call.inputTokens,
      output_tokens: call.outputTokens,
      estimated_cost_usd: estimateCostUsd(call.modelId, call.inputTokens, call.outputTokens),
      price_version: priceVersionFor(call.modelId),
      latency_ms: call.latencyMs,
    };
  } catch {
    return {
      title: "The register could not be read just now",
      statements: [],
      gaps: ["The chatbot call failed. Your accepted judgments were not changed."],
      citations: [],
      model_id: "unavailable",
      prompt_version: "1.0.0",
      input_tokens: null,
      output_tokens: null,
      estimated_cost_usd: null,
      price_version: null,
      latency_ms: 0,
    };
  }
}
