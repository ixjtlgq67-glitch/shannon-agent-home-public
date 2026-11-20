import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="font-serif text-2xl">
        Shannon
      </Link>
      <p className="mt-8 text-xs uppercase tracking-[0.16em] text-brass">Help</p>
      <h1 className="mt-2 font-serif text-4xl">How a judgment gets kept</h1>
      <div className="mt-8 grid gap-8 text-sm leading-relaxed text-ink-soft">
        <section>
          <h2 className="font-serif text-2xl text-ink">Save from the page you are on</h2>
          <p className="mt-2">
            Install Save to Shannon, or drag the bookmarklet on the{" "}
            <Link className="underline" href="/get-the-button">
              save button page
            </Link>
            . The button sends the address, the title, and the words you can see, so a page you can read still saves when a server fetch would be blocked. You can still paste an address in the library. Private network addresses are refused.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5">
            <li>
              On the{" "}
              <Link className="underline" href="/get-the-button">
                save button page
              </Link>
              , choose Download the Chrome extension and unzip it. That copy already has this site’s address.
            </li>
            <li>Open chrome://extensions or edge://extensions, turn on Developer mode, and choose Load unpacked.</li>
            <li>Paste the save token from Settings. You do not type the address.</li>
            <li>Click the toolbar button, press Ctrl+Shift+S, or right-click the page and choose Save to Shannon.</li>
          </ol>
          <img src="/guide/extension-popup.png" alt="Save to Shannon confirmation" className="mt-4 w-full max-w-sm rounded-2xl border border-line" />
        </section>
        <section>
          <h2 className="font-serif text-2xl text-ink">The panel</h2>
          <p className="mt-2">
            Triage recommends from the uses you declared. The Conductor sets a per-item call budget and seats at most three of those uses plus the Skeptic. Each role returns at most two proposals. Historian, as seeded, waits until you have accepted something, because it is there to argue with your own record. You can edit or disable uses.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl text-ink">The quotation check</h2>
          <p className="mt-2">
            Server code, not a model, checks that the quotation is an exact substring of the frozen paragraph named by the locator. Mismatches are dropped and noted in the audit log. You never see them as pending. A run is COMPLETE when every seated role answered, and INCOMPLETE when one timed out or failed. Successful proposals are kept either way.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl text-ink">Accept and reject</h2>
          <p className="mt-2">
            A signed-in reader can decide immediately. The decision is signed with the name on the account. Accept creates the register entry. Reject, with an optional one-line reason, goes to the audit log. A decision cannot be rewritten. Leaving a card alone leaves it pending. Confirming an email is optional.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl text-ink">Finding it later</h2>
          <p className="mt-2">
            Search the register for the judgment or the exact quotation. It is still there after you sign out. Ask answers only from accepted judgments and cites them. If the register does not support an answer, it says so.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl text-ink">Cost</h2>
          <p className="mt-2">
            Every model call logs model, prompt version, tokens, latency, and an estimated cost from a versioned price table. Missing usage is unknown, not zero. Cost per accepted judgment divides all of that spend, including rejected work and retries, by the number accepted. With none accepted, the figure is not available.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl text-ink">Demo mode and accounts</h2>
          <p className="mt-2">
            With no Supabase environment variables, accounts and the register live in a local file on the server. An optional confirmation note is in the in-app inbox. With no OpenAI key, the panel is canned output that still passes the real quotation check. Set SUPABASE_URL and SUPABASE_ANON_KEY to use Supabase Auth. The server uses the signed-in reader’s token and row-level security. Article text is not written to the repository.
          </p>
        </section>
        <section>
          <h2 className="font-serif text-2xl text-ink">What is not here yet</h2>
          <p className="mt-2">
            Visual relationship maps, sharing a register, billing, and automatic publishing are deferred. Taste is readable and editable, and a short note is distilled from accepts, but it is not a learned model. The Part 1 time-savings figure stays a hypothesis until a client baseline exists.
          </p>
        </section>
      </div>
      <p className="mt-10 text-sm">
        <Link className="underline" href="/signup">
          Open a register
        </Link>
      </p>
    </div>
  );
}
