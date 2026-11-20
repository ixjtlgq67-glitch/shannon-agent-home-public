import Link from "next/link";
import { QuotedParagraph } from "@/components/quoted";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { roleLabel } from "@/lib/shannon/core";
import { getStore } from "@/lib/store";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { q = "" } = await searchParams;
  const store = await getStore();
  const entries = await store.searchRegister(user.id, q);

  return (
    <div className="grid gap-8">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-brass">Register</p>
        <h1 className="mt-2 font-serif text-4xl">What you accepted</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Search the judgment or the exact quotation. Rejections are not here. They stay in the audit log on the ledger.
        </p>
      </div>
      <form className="grid gap-2" action="/app/register">
        <Label htmlFor="q">Search your register</Label>
        <div className="flex flex-wrap gap-2">
          <Input id="q" name="q" defaultValue={q} placeholder="A phrase from a quotation or a judgment" className="max-w-xl" />
          <button className="rounded-full bg-seal px-4 text-sm text-seal-ink" type="submit">
            Search
          </button>
        </div>
      </form>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-soft">
          {q.trim()
            ? `Nothing accepted matches “${q.trim()}”.`
            : "The register is empty. Accept a pending proposal and it will be here after you sign out and back in."}{" "}
          <Link className="underline" href="/app">
            Save a source
          </Link>
        </p>
      ) : (
        <ul className="grid gap-5">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-3xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="moss">Accepted</Badge>
                <Badge>{roleLabel(entry.role_id)}</Badge>
                <span className="text-xs text-ink-soft">
                  {entry.source_title} · paragraph {entry.paragraph_id}
                </span>
              </div>
              <h2 className="mt-4 font-serif text-2xl leading-snug">{entry.judgment}</h2>
              <div className="mt-4">
                <QuotedParagraph text={entry.quote} quote={entry.quote} />
              </div>
              <p className="mt-3 text-sm text-ink-soft">{entry.reasoning}</p>
              <p className="mt-3 text-xs text-ink-soft">
                Signed by {entry.human_name} on {formatWhen(entry.decided_at)} · {entry.model_id} · prompt {entry.prompt_version} · {entry.source_version}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
