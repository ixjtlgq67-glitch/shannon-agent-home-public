import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { applyDecision, validateBatch } from "@/lib/shannon/core";
import { captureAndRun } from "@/lib/shannon/pipeline";
import { SAMPLE_TEXT, SAMPLE_TITLE } from "@/lib/shannon/sample";
import { MemoryStore } from "@/lib/store/memory";

const root = new URL("../agent-home/examples/", import.meta.url);
const source = JSON.parse(readFileSync(new URL("source.json", root), "utf8"));
const batch = JSON.parse(readFileSync(new URL("proposals.json", root), "utf8"));

function proposal() {
  return validateBatch(batch, source, {
    role: "use:teaching",
    model: "synthetic-model",
    promptVersion: "1.0.0",
    declaredUses: ["teaching"],
  })[0];
}

describe("accept and reject gate", () => {
  const decision = {
    proposal_id: "demo-proposal-1",
    user_id: "demo-user",
    human_name: "Test Human",
    action: "reject" as const,
    reason: "Not useful",
    decided_at: "2026-10-26T12:00:00Z",
  };

  it("keeps a rejection out of the register", () => {
    const result = applyDecision(proposal(), decision, "demo-user");
    expect(result.registerEntry).toBeNull();
    expect(result.audit.action).toBe("reject");
    expect(result.status).toBe("rejected");
  });

  it("lets a named reader accept once, and nobody else", () => {
    const accepted = { ...decision, action: "accept" as const, reason: "Useful" };
    expect(applyDecision(proposal(), accepted, "demo-user").status).toBe("accepted");
    expect(applyDecision(proposal(), accepted, "demo-user").registerEntry?.quote).toBe(proposal().quote);
    expect(() => applyDecision(proposal(), accepted, "other-user")).toThrow(/Unauthorized/);
    expect(() => applyDecision(proposal(), accepted, "demo-user", "accepted")).toThrow(/finalized/);
    expect(() => applyDecision(proposal(), { ...accepted, human_name: " " }, "demo-user")).toThrow(/Named human/);
  });

  it("persists an acceptance and hides a rejection from search, including after a new session", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.SUPABASE_URL;
    const store = new MemoryStore(path.join(mkdtempSync(path.join(tmpdir(), "shannon-")), "store.json"));
    const { userId, token } = await store.signUp({
      email: "reader@example.com",
      password: "correct-horse",
      displayName: "Ada Reader",
    });
    const confirmed = await store.confirm(token);
    expect(confirmed.userId).toBe(userId);
    const captured = await captureAndRun({
      user: { id: userId, displayName: "Ada Reader" },
      store,
      title: SAMPLE_TITLE,
      url: null,
      text: SAMPLE_TEXT,
    });
    expect("runId" in captured).toBe(true);
    if (!("runId" in captured)) return;
    const run = await store.getRun(userId, captured.runId);
    expect(run?.status).toBe("complete");
    expect(run?.planned_roles).not.toContain("use:historian");
    const proposals = await store.listProposals(userId, captured.runId);
    const pending = proposals.filter((item) => item.status === "pending");
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.length).toBeLessThanOrEqual(8);
    const sourceRecord = await store.getSource(userId, run!.source_id);
    for (const item of pending) {
      const paragraph = sourceRecord!.paragraphs.find((row) => row.id === item.paragraph_id);
      expect(paragraph?.text.includes(item.quote)).toBe(true);
    }
    const audit = await store.listAudit(userId);
    expect(audit.some((entry) => entry.kind === "quote_dropped")).toBe(true);

    const accepted = await store.decide({
      userId,
      proposalId: pending[0].proposal_id,
      action: "accept",
      reason: "Worth keeping",
      humanName: "Ada Reader",
    });
    expect(accepted.registerEntry?.quote).toBe(pending[0].quote);
    const rejected = await store.decide({
      userId,
      proposalId: pending[1].proposal_id,
      action: "reject",
      reason: "Not this week",
      humanName: "Ada Reader",
    });
    expect(rejected.registerEntry).toBeNull();

    await store.logout(confirmed.sessionId);
    const again = await store.login("reader@example.com", "correct-horse");
    const session = await store.userForSession(again.sessionId);
    expect(session?.id).toBe(userId);
    const found = await store.searchRegister(userId, pending[0].quote);
    expect(found).toHaveLength(1);
    expect(found[0].quote).toBe(pending[0].quote);
    const hidden = await store.searchRegister(userId, pending[1].judgment);
    expect(hidden.every((entry) => entry.proposal_id !== pending[1].proposal_id)).toBe(true);

    const stranger = await store.signUp({
      email: "other@example.com",
      password: "correct-horse",
      displayName: "Other Reader",
    });
    await store.confirm(stranger.token);
    expect(await store.searchRegister(stranger.userId, pending[0].quote)).toHaveLength(0);
    await expect(
      store.decide({
        userId: stranger.userId,
        proposalId: pending[2].proposal_id,
        action: "accept",
        reason: "Not mine",
        humanName: "Other Reader",
      }),
    ).rejects.toThrow(/Unauthorized/);

    const second = await captureAndRun({
      user: { id: userId, displayName: "Ada Reader" },
      store,
      title: "Second synthetic note",
      url: null,
      text: SAMPLE_TEXT,
    });
    if ("runId" in second) {
      const next = await store.getRun(userId, second.runId);
      expect(next?.planned_roles).toContain("use:historian");
    }
  });
});
