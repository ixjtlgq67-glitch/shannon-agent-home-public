import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { dropMismatches, validateBatch } from "@/lib/shannon/core";
import type { Proposal } from "@/lib/shannon/types";

const root = new URL("../agent-home/examples/", import.meta.url);
const source = JSON.parse(readFileSync(new URL("source.json", root), "utf8"));
const batch = JSON.parse(readFileSync(new URL("proposals.json", root), "utf8"));
const expected = {
  role: "use:teaching",
  model: "synthetic-model",
  promptVersion: "1.0.0",
  declaredUses: ["teaching"],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("quote validator", () => {
  it("accepts an exact quotation from the named paragraph", () => {
    expect(validateBatch(batch, source, expected)).toHaveLength(1);
  });

  it("rejects a fabricated quotation", () => {
    const raw = clone(batch);
    raw.proposals[0].quote = "This text does not exist";
    expect(() => validateBatch(raw, source, expected)).toThrow(/Quote does not match/);
  });

  it("rejects a quotation taken from the wrong paragraph", () => {
    const raw = clone(batch);
    raw.proposals[0].paragraph_id = "p2";
    expect(() => validateBatch(raw, source, expected)).toThrow(/Quote does not match/);
  });

  it("rejects a blank quotation", () => {
    const raw = clone(batch);
    raw.proposals[0].quote = " ";
    expect(() => validateBatch(raw, source, expected)).toThrow(/Quote does not match/);
  });

  it("rejects the wrong reader, source, or frozen version", () => {
    for (const field of ["user_id", "source_id", "source_version"] as const) {
      const raw = clone(batch);
      raw.proposals[0][field] = "other";
      expect(() => validateBatch(raw, source, expected)).toThrow(/Wrong user, source or frozen version/);
    }
  });

  it("rejects forged model provenance", () => {
    for (const [field, key] of [
      ["role_id", "role"],
      ["model_id", "model"],
      ["prompt_version", "prompt"],
    ] as const) {
      const raw = clone(batch);
      raw.proposals[0][field] = "wrong";
      expect(() => validateBatch(raw, source, expected), key).toThrow(/Wrong runtime provenance/);
    }
  });

  it("rejects an undeclared use", () => {
    const raw = clone(batch);
    raw.proposals[0].use_id = "unknown";
    expect(() => validateBatch(raw, source, expected)).toThrow(/declared use/);
  });

  it("rejects a third proposal from one role", () => {
    const raw = clone(batch);
    raw.proposals = [raw.proposals[0], raw.proposals[0], raw.proposals[0]];
    raw.proposals[1] = { ...raw.proposals[0], proposal_id: "b" };
    raw.proposals[2] = { ...raw.proposals[0], proposal_id: "c" };
    expect(() => validateBatch(raw, source, expected)).toThrow(/More than two/);
  });

  it("rejects a status field smuggled onto a proposal", () => {
    const raw = clone(batch);
    (raw.proposals[0] as Proposal & { status?: string }).status = "accepted";
    expect(() => validateBatch(raw, source, expected)).toThrow();
  });

  it("rejects a frozen source with a duplicate locator", () => {
    const broken = clone(source);
    broken.paragraphs.push(broken.paragraphs[0]);
    expect(() => validateBatch(batch, broken, expected)).toThrow(/Duplicate paragraph locator/);
  });

  it("drops a mismatched quotation and keeps its valid sibling", () => {
    const raw = clone(batch);
    raw.proposals.push({
      ...raw.proposals[0],
      proposal_id: "bad",
      quote: "This quotation was not in the frozen source.",
    });
    raw.proposals.unshift(raw.proposals.pop());
    const { kept, dropped } = dropMismatches(raw, source, expected);
    expect(kept.map((proposal) => proposal.proposal_id)).toEqual(["demo-proposal-1"]);
    expect(dropped.map((drop) => drop.reason).join(" ")).toMatch(/Quote does not match/);
  });
});
