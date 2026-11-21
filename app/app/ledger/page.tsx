import { getCurrentUser } from "@/lib/auth";
import { formatRate, formatUsd, formatWhen } from "@/lib/format";
import { metrics } from "@/lib/shannon/core";
import { getStore } from "@/lib/store";

export default async function LedgerPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const store = await getStore();
  const costs = await store.listCosts(user.id);
  const counts = await store.decisionCounts(user.id);
  const audit = await store.listAudit(user.id);
  const runs = await store.listRuns(user.id);
  const report = metrics({
    accepted: counts.accepted,
    reviewed: counts.reviewed,
    eventCosts: costs.map((event) => event.estimated_cost_usd),
  });
  const unknown = costs.filter((event) => event.estimated_cost_usd === null).length;
  const dropped = audit.filter((entry) => entry.kind === "quote_dropped").length;
  const checked = dropped + (await store.listRegister(user.id)).length + audit.filter((entry) => entry.kind === "rejection").length;
  const firstAccepted = (await store.listRegister(user.id)).at(-1);

  return (
    <div className="grid gap-8">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-brass">Ledger · Qi Liu</p>
        <h1 className="mt-2 font-serif text-4xl">Cost and evaluation</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Acceptance rate is accepted proposals over proposals you reviewed. Pending cards are not rejections. Cost per accepted judgment counts the Conductor, rejected work, retries, and the chatbot. Unknown prices stay unknown.
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Acceptance rate" value={formatRate(report.acceptance_rate)} />
        <Stat label="Cost per accepted judgment" value={formatUsd(report.cost_per_accepted_judgment_usd)} />
        <Stat label="All model spend" value={formatUsd(report.total_model_cost_usd)} />
        <Stat label="Reviewed" value={String(counts.reviewed)} />
      </dl>
      <div className="grid gap-3 text-sm text-ink-soft md:grid-cols-3">
        <p>{runs.filter((run) => run.status === "complete").length} complete runs, {runs.filter((run) => run.status === "incomplete").length} incomplete.</p>
        <p>{unknown === 0 ? "Every logged call has a price-table estimate." : `${unknown} calls have unknown cost and keep the total unavailable.`}</p>
        <p>
          Quotation drops: {dropped}. {checked ? `${dropped} of ${checked} checked proposals were dropped or decided.` : "No quotations checked yet."}{" "}
          {firstAccepted ? `First acceptance ${formatWhen(firstAccepted.decided_at)}.` : "No accepted judgment yet, so cost per judgment is not available."}
        </p>
      </div>
      <section>
        <h2 className="font-serif text-2xl">Calls</h2>
        {costs.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No model calls yet. Saving a source logs triage, the Conductor, and each role.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-paper-2 text-xs uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 font-medium">Model</th>
                  <th className="px-3 py-2 font-medium">Tokens</th>
                  <th className="px-3 py-2 font-medium">Cost</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((event) => (
                  <tr key={event.id} className="border-t border-line">
                    <td className="px-3 py-2 whitespace-nowrap">{formatWhen(event.created_at)}</td>
                    <td className="px-3 py-2">{event.agent_id}{event.retry_of ? " · retry" : ""}</td>
                    <td className="px-3 py-2">{event.model_id}</td>
                    <td className="px-3 py-2">{event.input_tokens ?? "?"} / {event.output_tokens ?? "?"}</td>
                    <td className="px-3 py-2">{formatUsd(event.estimated_cost_usd)}</td>
                    <td className="px-3 py-2">{event.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section>
        <h2 className="font-serif text-2xl">Audit log</h2>
        <p className="mt-1 text-sm text-ink-soft">Rejections and dropped quotations. Article text is not stored here.</p>
        {audit.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No audit events yet.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {audit.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-line px-3 py-2 text-sm">
                <span className="uppercase tracking-wide text-ink-soft">{entry.kind}</span> · {entry.summary}
                <span className="mt-1 block text-xs text-ink-soft">{formatWhen(entry.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <dt className="text-xs uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="mt-2 font-serif text-2xl">{value}</dd>
    </div>
  );
}
