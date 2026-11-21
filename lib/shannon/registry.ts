import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";

export type AgentDefinition = {
  id: string;
  name: string;
  group: string;
  pod: string;
  prompt_version: string;
  instructions: string;
  output_model: string;
  prompt_sha256: string;
  tools: unknown[];
};

const ROOT = path.join(process.cwd(), "agent-home");

let cache: AgentDefinition[] | null = null;

export function agentHomeRoot(): string {
  return ROOT;
}

export function registry(): AgentDefinition[] {
  if (cache) return cache;
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "agents/manifest.json"), "utf8")) as {
    agents: AgentDefinition[];
  };
  cache = manifest.agents;
  return cache;
}

export function definition(agentId: string): AgentDefinition {
  const entry = registry().find((agent) => agent.id === agentId);
  if (!entry) throw new Error(`Unknown agent: ${agentId}`);
  return entry;
}

/** Same bundle the Python runner sends: AGENTS.md, the pod rubric, the decision log, then the agent file. */
export function instructionsFor(agentId: string): string {
  const entry = definition(agentId);
  const parts = ["AGENTS.md", `pods/${entry.pod}.md`, "operations/DECISIONS.md", entry.instructions];
  return parts.map((part) => readFileSync(path.join(ROOT, part), "utf8")).join("\n\n");
}

export function assertRegistryIntact(): number {
  const entries = registry();
  const ids = new Set(entries.map((entry) => entry.id));
  if (ids.size !== entries.length) throw new Error("Duplicate agent ID");
  for (const entry of entries) {
    const file = readFileSync(path.join(ROOT, entry.instructions));
    if (!file.includes(entry.prompt_version)) throw new Error(`Prompt version drift: ${entry.id}`);
    const digest = createHash("sha256").update(file).digest("hex");
    if (digest !== entry.prompt_sha256) throw new Error(`Prompt checksum drift: ${entry.id}`);
    if (entry.tools?.length) throw new Error("Unexpected tool privileges");
  }
  return entries.length;
}
