import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div>
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5">
        <Link href="/" className="font-serif text-2xl tracking-tight">
          Shannon
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/help" className="rounded-full px-3 py-2 text-ink-soft hover:bg-paper-2">
            Help
          </Link>
          <Link href="/try" className="rounded-full bg-seal px-4 py-2 text-seal-ink">
            Start saving
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl items-end gap-10 px-4 pb-16 pt-8 md:grid-cols-[1.15fr_0.85fr] md:pt-16">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-brass">Columbia TMGT PS5200 · Team Shannon</p>
            <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight md:text-6xl">
              The problem was never saving the link.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              It is recovering the reasoning when the deadline arrives. Shannon freezes what you saved, asks a small panel for judgments that quote the source exactly, and writes into your register only what you accept.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/try" className="rounded-full bg-seal px-5 py-3 text-seal-ink">
                Start saving
              </Link>
              <Link href="#specimen" className="rounded-full border border-line bg-card px-5 py-3">
                See a judgment
              </Link>
            </div>
          </div>
          <article id="specimen" className="rounded-3xl border border-line bg-card p-6">
            <div className="flex items-center justify-between gap-3">
              <Badge variant="brass">Pending</Badge>
              <span className="text-xs uppercase tracking-wide text-ink-soft">Skeptic · p2</span>
            </div>
            <p className="mt-4 font-quote text-2xl leading-snug">
              <mark>The imaginary pilot has not measured time savings.</mark>
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Do not treat this as evidence that the workshop saved anyone time. The sentence says the measurement was not done.
            </p>
            <p className="mt-5 text-xs text-ink-soft">A specimen, not your register. Your judgments appear only after you accept them.</p>
          </article>
        </section>

        <div className="rule" />

        <section className="mx-auto grid max-w-5xl gap-8 px-4 py-14 md:grid-cols-3">
          {[
            ["Save", "A URL when the page will give up its text. A paste when it will not. Paragraphs are frozen with stable locators before any model sees them."],
            ["A panel, not a pile", "At most four roles, two proposals each. The Skeptic always argues against the item. Practitioner and Economist read your declared uses. Historian waits until you have accepted something."],
            ["You decide", "Accept writes the judgment, the quotation, and your name into the register. Reject stays in the audit log. Ignoring a card leaves it pending."],
          ].map(([title, body]) => (
            <div key={title}>
              <h2 className="font-serif text-2xl">{title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{body}</p>
            </div>
          ))}
        </section>

        <section className="bg-ink text-paper">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 md:grid-cols-2">
            <div>
              <h2 className="font-serif text-3xl">The check is not a model.</h2>
              <p className="mt-4 leading-relaxed text-paper/80">
                Every proposal has to name a paragraph and quote it verbatim. Ordinary server code compares that quotation to the frozen text and drops anything that does not match, before you see it. A validator that can be persuaded is not a validator.
              </p>
            </div>
            <div>
              <h2 className="font-serif text-3xl">Cost includes the nos.</h2>
              <p className="mt-4 leading-relaxed text-paper/80">
                Every model call is logged: the Conductor, the roles, the retries, the work you reject. Cost per accepted judgment is all of that spend divided by what you kept. If you have accepted nothing, the figure is not available. It is not zero.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="font-serif text-3xl">Thirty seconds, no tagging.</h2>
          <ol className="mt-6 grid gap-4 text-ink-soft md:grid-cols-4">
            {[
              "Save a source while you are still in the work.",
              "Read a handful of pending judgments, each glued to a sentence.",
              "Accept one. Reject another with a line about why.",
              "Weeks later, search the judgment and get the quotation back.",
            ].map((step, index) => (
              <li key={step} className="rounded-2xl border border-line bg-card p-4">
                <span className="font-serif text-2xl text-seal">{index + 1}</span>
                <p className="mt-2 text-sm leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <Link href="/signup" className="rounded-full bg-seal px-5 py-3 text-seal-ink">
              Start with a name and an email
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-4 py-8 text-sm text-ink-soft">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-3">
          <p>Team Shannon · Guillermo Ravelo, Sneha Sudharsan, Carlos del Rosario, Qi Liu</p>
          <p>
            Contracts from the{" "}
            <a className="underline" href="https://github.com/ixjtlgq67-glitch/shannon-agent-home-public">
              public agent home
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
