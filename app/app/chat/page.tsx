import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { askRegister } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const store = await getStore();
  const turns = await store.listChat(user.id);
  const register = await store.listRegister(user.id);

  return (
    <div className="grid gap-8">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-brass">Ask</p>
        <h1 className="mt-2 font-serif text-4xl">Ask the register</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Answers come from judgments you accepted, with the quotation attached. The chatbot cannot see rejected work, other readers, or a source you have not kept.
        </p>
      </div>
      {register.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm text-ink-soft">
          There is nothing to ask yet. <Link className="underline" href="/app">Save a source</Link> and accept one judgment first.
        </p>
      ) : null}
      <ol className="grid gap-4">
        {turns.length === 0 ? <li className="text-sm text-ink-soft">No questions yet.</li> : null}
        {turns.map((turn) => (
          <li key={turn.id} className={turn.role === "user" ? "ml-auto max-w-xl rounded-2xl bg-ink px-4 py-3 text-paper" : "max-w-2xl rounded-2xl border border-line bg-card px-4 py-3"}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.text}</p>
            {turn.citations?.length ? (
              <ul className="mt-3 grid gap-2">
                {turn.citations.map((citation) => (
                  <li key={citation.id} className="rounded-xl bg-paper px-3 py-2 text-xs text-ink">
                    <Link className="underline" href={`/app/register?q=${encodeURIComponent(citation.quote.slice(0, 80))}`}>
                      {citation.judgment}
                    </Link>
                    <span className="mt-1 block font-quote text-sm">“{citation.quote}”</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {turn.gaps?.length ? <p className="mt-2 text-xs text-ink-soft">{turn.gaps.join(" ")}</p> : null}
          </li>
        ))}
      </ol>
      <ActionForm action={askRegister} className="grid gap-3">
        <Label htmlFor="question">Question</Label>
        <Textarea id="question" name="question" placeholder="What did I accept about time savings?" required minLength={3} />
        <div>
          <SubmitButton pendingLabel="Reading the register…">Ask</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
