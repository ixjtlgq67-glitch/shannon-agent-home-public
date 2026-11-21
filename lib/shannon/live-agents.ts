import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from "@openai/agents";
import OpenAI from "openai";
import type { ZodObject, ZodRawShape } from "zod";
import { modelName } from "@/lib/config";
import { definition, instructionsFor } from "./registry";

let clientReady = false;

function ensureClient() {
  if (clientReady) return;
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY in the private server environment");
  setTracingDisabled(true);
  setDefaultOpenAIClient(new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 }));
  clientReady = true;
}

export type LiveCall = {
  output: unknown;
  modelId: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  requests: number;
};

/**
 * One tool-free Agents SDK call. The Conductor, not the provider, decides retries.
 * maxTurns is 1. Output tokens are capped. Tracing is off.
 */
export async function runStructured(
  agentId: string,
  schema: ZodObject<ZodRawShape>,
  payload: Record<string, unknown>,
): Promise<LiveCall> {
  ensureClient();
  const entry = definition(agentId);
  const model = modelName();
  const agent = new Agent({
    name: entry.name,
    instructions: instructionsFor(agentId),
    model,
    tools: [],
    outputType: schema,
    modelSettings: { maxTokens: 1500, store: false },
  });
  const started = Date.now();
  const result = await run(agent, JSON.stringify(payload), { maxTurns: 1 });
  const usage = result.runContext.usage;
  const output = result.finalOutput;
  if (output === undefined || output === null) throw new Error(`${entry.name} returned no structured output`);
  return {
    output,
    modelId: model,
    promptVersion: entry.prompt_version,
    inputTokens: Number.isFinite(usage.inputTokens) ? usage.inputTokens : null,
    outputTokens: Number.isFinite(usage.outputTokens) ? usage.outputTokens : null,
    latencyMs: Date.now() - started,
    requests: usage.requests || 1,
  };
}
