import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { deduplicate, metrics, panelStatus, planReview, prepareAgentContext, selectPanel, validateBatch } from "@/lib/shannon/core";
import type { Proposal } from "@/lib/shannon/types";

const root = new URL("../agent-home/examples/", import.meta.url);
const source = JSON.parse(readFileSync(new URL("source.json", root), "utf8"));
const batch = JSON.parse(readFileSync(new URL("proposals.json", root), "utf8"));

function one(): Proposal {
  return validateBatch(batch, source, {
    role: "use:teaching",
    model: "synthetic-model",
    promptVersion: "1.0.0",
    declaredUses: ["teaching"],
  })[0];
}

describe("conductor budget and dedupe", () => {
  it("caps the panel at four roles including the Skeptic", () => {
    expect(selectPanel(["a", "b", "a", "c", "d"], ["a", "b", "c", "d"], 10)).toEqual([
      "skeptic",
      "use:a",
      "use:b",
      "use:c",
    ]);
  });

  it("reserves the Skeptic before any declared use", () => {
    expect(selectPanel(["a"], ["a"], 1)).toEqual(["skeptic"]);
    expect(() => selectPanel(["a"], ["a"], 0)).toThrow(/Skeptic/);
    expect(() => selectPanel(["b"], ["a"], 2)).toThrow(/Undeclared/);
  });

  it("skips Historian until the reader has accepted history, and seats it once they have", () => {
    const shared = {
      recommended: ["practitioner", "economist", "historian"],
      declared: ["practitioner", "economist", "historian"],
      requiresHistory: ["historian"],
      callBudget: 8,
      spentCalls: 2,
    };
    const waiting = planReview({ ...shared, hasHistory: false });
    expect(waiting.roles).toEqual(["skeptic", "use:practitioner", "use:economist"]);
    expect(waiting.skipped).toEqual(["use:historian"]);
    expect(waiting.plannedCalls).toBeLessThanOrEqual(8);

    const ready = planReview({ ...shared, hasHistory: true });
    expect(ready.roles).toEqual(["skeptic", "use:practitioner", "use:economist", "use:historian"]);
    expect(ready.roles).toHaveLength(4);
  });

  it("does not spend the concept call if that would displace the Skeptic", () => {
    const tight = planReview({
      recommended: ["practitioner"],
      declared: ["practitioner"],
      requiresHistory: [],
      hasHistory: false,
      callBudget: 3,
      spentCalls: 2,
    });
    expect(tight.roles).toEqual(["skeptic"]);
    expect(tight.includeConcept).toBe(false);
  });

  it("labels a partial panel incomplete and a full panel complete", () => {
    expect(panelStatus(["skeptic", "use:a"], ["use:a"])).toBe("incomplete");
    expect(panelStatus(["skeptic", "use:a"], ["use:a", "skeptic"])).toBe("complete");
  });

  it("collapses exact duplicates inside a role and keeps dissent", () => {
    const proposal = one();
    const duplicate = { ...proposal, proposal_id: "duplicate" };
    const dissent = { ...proposal, proposal_id: "dissent", judgment: "The source does not establish time savings." };
    const otherRole = { ...proposal, proposal_id: "skeptic-1", role_id: "skeptic", use_id: null, exploration: false };
    expect(deduplicate([proposal, duplicate, dissent, otherRole])).toHaveLength(3);
  });

  it("refuses a proposal id reused across batches", () => {
    const proposal = one();
    expect(() => deduplicate([proposal, proposal])).toThrow(/Duplicate proposal ID across batches/);
  });

  it("keeps unknown cost unknown and reports not-available when nothing was accepted", () => {
    expect(metrics({ accepted: 0, reviewed: 4, eventCosts: [1] }).cost_per_accepted_judgment_usd).toBeNull();
    expect(metrics({ accepted: 1, reviewed: 4, eventCosts: [1, null] }).total_model_cost_usd).toBeNull();
    const report = metrics({ accepted: 2, reviewed: 4, eventCosts: [1, 2, 3] });
    expect(report.cost_per_accepted_judgment_usd).toBe(3);
    expect(report.acceptance_rate).toBe(0.5);
  });

  it("never hands the Skeptic a taste profile", () => {
    const cleaned = prepareAgentContext("skeptic", {
      source: { user_id: "demo-user" },
      taste_profile: "favor positive opinions",
      declared_use: { taste: "hidden" },
      accepted_history: [],
    });
    expect(Object.keys(cleaned).sort()).toEqual(["accepted_history", "source"]);
  });

  it("refuses history that is not accepted or not this reader", () => {
    for (const record of [
      { user_id: "other", status: "accepted" },
      { user_id: "demo-user", status: "pending" },
    ]) {
      expect(() =>
        prepareAgentContext("chatbot", { authenticated_user_id: "demo-user", accepted_judgments: [record] }),
      ).toThrow(/Unaccepted or unauthorized history/);
    }
  });
});
