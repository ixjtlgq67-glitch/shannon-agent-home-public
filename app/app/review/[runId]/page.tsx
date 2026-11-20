import Link from "next/link";
import { notFound } from "next/navigation";
import { DecisionForm } from "@/components/decision-form";
import { QuotedParagraph } from "@/components/quoted";
import { Badge } from "@/components/ui/badge";
import { decideProposal } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { roleLabel } from "@/lib/shannon/core";
import { getStore } from "@/lib/store";

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ runId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { runId } = await params;
  const query = await searchParams;
  const store = await getStore();
  const run = await store.getRun(user.id, runId);
  if (!run) notFound();
  const source = await store.getSource(user.id, run.source_id);
  if (!source) notFound();
  const proposals = await store.listProposals(user.id, runId);
  const concepts = await store.listConcepts(user.id, runId);
  const audit = (await store.listAudit(user.id)).filter((entry) => entry.run_id === runId);
  const pending = proposals.filter((proposal) => proposal.status === "pending");
  const decided = proposals.filter((proposal) => proposal.status === "accepted" || proposal.status === "rejected");
  const paragraphs = new Map(source.paragraphs.map((paragraph) => [paragraph.id, paragraph.text]));

  return (
    <div className="grid gap-8">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-brass">Review</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-4xl">{source.title}</h1>
          <Badge variant={run.status === "complete" ? "moss" : "brass"}>{run.status === "complete" ? "COMPLETE" : "INCOMPLETE"}</Badge>
        </div>
        <p className="mt-3 max-w-2xl text-sm text-ink-soft">
          Frozen as {source.source_version}. {source.origin === "url" && source.url ? source.url : "Pasted text."} The panel was{" "}
          {run.planned_roles.map(roleLabel).join(", ") || "not seated"}.
          {run.skipped_roles.length ? ` Skipped: ${run.skipped_roles.map(roleLabel).join(", ")}.` : ""}
          {source.excerpted ? " Shannon kept the opening paragraphs of a longer page." : ""}
          {run.failed_roles.length ? ` Did not finish: ${run.failed_roles.map((role) => `${roleLabel(role.role_id)} (${role.reason})`).join("; ")}.` : ""}
        </p>
      </div>

      {query.saved === "accepted" ? (
        <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm" role="status">
          Accepted. It is in your register, with the quotation. <Link className="underline" href="/app/register">Search it</Link>.
        </p>
      ) : null}
      {query.saved === "rejected" ? (
        <p className="rounded-2xl border border-line bg-card px-4 py-3 text-sm" role="status">
          Rejected. The note is in the audit log, not the register.
        </p>
      ) : null}

      {pending.length === 0 ? (
        <p className="text-sm text-ink-soft">
          {proposals.length === 0
            ? "No valid proposal survived. If a role timed out, the run stays incomplete and the successful work is still here when it exists."
            : "Nothing is still pending on this run."}
        </p>
      ) : (
        <ul className="grid gap-5">
          {pending.map((proposal) => (
            <li key={proposal.proposal_id} className="rounded-3xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="brass">Pending</Badge>
                <Badge>{roleLabel(proposal.role_id)}</Badge>
                {proposal.exploration ? <Badge variant="seal">Exploration</Badge> : null}
                <span className="text-xs text-ink-soft">Paragraph {proposal.paragraph_id}</span>
              </div>
              <h2 className="mt-4 font-serif text-2xl leading-snug">{proposal.judgment}</h2>
              <div className="mt-4 rounded-2xl bg-paper px-4 py-3">
                <QuotedParagraph text={paragraphs.get(proposal.paragraph_id) ?? proposal.quote} quote={proposal.quote} />
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{proposal.reasoning}</p>
              <p className="mt-3 text-xs text-ink-soft">
                {proposal.source_id} · {proposal.source_version} · {proposal.model_id} · prompt {proposal.prompt_version}
              </p>
              <DecisionForm action={decideProposal} proposalId={proposal.proposal_id} />
            </li>
          ))}
        </ul>
      )}

      {audit.some((entry) => entry.kind === "quote_dropped") ? (
        <p className="text-sm text-ink-soft">
          {audit.filter((entry) => entry.kind === "quote_dropped").length} proposal
          {audit.filter((entry) => entry.kind === "quote_dropped").length === 1 ? "" : "s"} dropped because the quotation or the locator did not match the frozen source. The bad text is not shown.
        </p>
      ) : null}

      {concepts.length ? (
        <section>
          <h2 className="font-serif text-2xl">Concepts</h2>
          <p className="mt-1 text-sm text-ink-soft">Labels only. They are not judgments and they are not in the register.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {concepts.map((concept) => (
              <li key={concept.id} className="rounded-full border border-line px-3 py-1 text-sm" title={concept.reason}>
                {concept.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {decided.length ? (
        <section>
          <h2 className="font-serif text-2xl">Already decided</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {decided.map((proposal) => (
              <li key={proposal.proposal_id} className="rounded-xl border border-line px-3 py-2">
                <span className="uppercase tracking-wide text-ink-soft">{proposal.status}</span> · {roleLabel(proposal.role_id)} · {proposal.judgment}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <details className="rounded-2xl border border-line bg-card p-4">
        <summary className="cursor-pointer font-medium">Frozen paragraphs</summary>
        <ol className="mt-4 grid gap-4">
          {source.paragraphs.map((paragraph) => (
            <li key={paragraph.id}>
              <p className="text-xs uppercase tracking-wide text-ink-soft">{paragraph.id}</p>
              <p className="mt-1 font-quote text-lg leading-relaxed">{paragraph.text}</p>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
