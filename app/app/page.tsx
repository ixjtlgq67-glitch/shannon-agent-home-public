import Link from "next/link";
import { RemoveBookmark } from "@/components/remove-bookmark";
import { SaveForm } from "@/components/save-form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removeBookmark, saveSource } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { formatWhen } from "@/lib/format";
import { bookmarkMatches, siteDomain } from "@/lib/shannon/freeze";
import { getStore } from "@/lib/store";

export default async function SavePage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const { q = "", error = "" } = await searchParams;
  const store = await getStore();
  const runs = await store.listRuns(user.id);
  const sources = (await store.listSources(user.id)).filter((source) => bookmarkMatches(source, q));
  const runFor = new Map(runs.map((run) => [run.source_id, run]));

  return (
    <div className="grid gap-10">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-brass">Library</p>
        <h1 className="mt-2 font-serif text-4xl">Sites you saved</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Shannon keeps the page, then proposes judgments from its words. Nothing enters your register until you accept it.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-seal">
          {error}
        </p>
      ) : null}
      <section className="rounded-3xl border border-line bg-card p-5 md:p-6">
        <SaveForm action={saveSource} />
      </section>
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-serif text-2xl">Library</h2>
          <form className="flex min-w-0 flex-1 flex-wrap gap-2 sm:max-w-md" action="/app">
            <Label htmlFor="q" className="sr-only">
              Search saved sites
            </Label>
            <Input id="q" name="q" defaultValue={q} placeholder="Title, address, or a phrase from the page" />
            <button className="rounded-full bg-seal px-4 text-sm text-seal-ink" type="submit">
              Search
            </button>
          </form>
        </div>
        {sources.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">
            {q.trim()
              ? `Nothing in your library matches “${q.trim()}”.`
              : "No sites yet. Paste an address above, or load the Harbor Line notes if you want a fictional example."}
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {sources.map((source) => {
              const run = runFor.get(source.source_id);
              const domain = siteDomain(source.url);
              return (
                <li key={source.source_id} className="rounded-2xl border border-line bg-card px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <SiteMark favicon={source.favicon_url} title={source.title} />
                      <div className="min-w-0">
                        {run ? (
                          <Link href={`/app/review/${run.id}`} className="block truncate font-medium hover:underline">
                            {source.title}
                          </Link>
                        ) : (
                          <span className="block truncate font-medium">{source.title}</span>
                        )}
                        <p className="mt-1 text-xs text-ink-soft">
                          {domain ?? "Pasted text"}
                          {" · "}
                          {formatWhen(source.captured_at)}
                          {source.excerpted ? " · Opening paragraphs only" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {run ? <Badge variant={run.status === "complete" ? "moss" : "brass"}>{run.status}</Badge> : null}
                      {source.url ? (
                        <a className="text-sm underline" href={source.url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : null}
                      <RemoveBookmark action={removeBookmark} sourceId={source.source_id} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function SiteMark({ favicon, title }: { favicon: string | null; title: string }) {
  if (favicon) {
    return <img src={favicon} alt="" width={20} height={20} className="mt-1 h-5 w-5 rounded-sm" />;
  }
  return (
    <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-sm bg-paper-2 text-[10px] text-ink-soft">
      {title.slice(0, 1).toUpperCase()}
    </span>
  );
}
