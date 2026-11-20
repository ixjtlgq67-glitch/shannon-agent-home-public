import Link from "next/link";
import { headers } from "next/headers";
import { BookmarkletLink } from "@/components/bookmarklet-link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { appOrigin } from "@/lib/config";
import { getStore } from "@/lib/store";

function bookmarklet(origin: string) {
  const code = `(function(){var t=((document.body&&document.body.innerText)||"").replace(/[ \\t]+\\n/g,"\\n").trim().slice(0,80000);var p={url:location.href,title:document.title,text:t};location.href=${JSON.stringify(origin)}+"/capture#"+encodeURIComponent(JSON.stringify(p));})();`;
  return `javascript:${encodeURIComponent(code)}`;
}

export default async function GetTheButtonPage() {
  const user = await getCurrentUser();
  const origin = appOrigin(await headers());
  let token = "";
  if (user) token = await (await getStore()).ensureSaveToken(user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="font-serif text-2xl">
        Shannon
      </Link>
      <p className="mt-8 text-xs uppercase tracking-[0.16em] text-brass">Save button</p>
      <h1 className="mt-2 font-serif text-4xl">Get the save button</h1>
      <p className="mt-3 max-w-xl text-ink-soft">
        You are on another site, the page is useful, you save it. One click. No pasting the address.
      </p>

      <section className="mt-8">
        <h2 className="font-serif text-2xl">Install the browser button</h2>
        <p className="mt-2 text-sm text-ink-soft">
          This download already knows <span className="text-ink">{origin}</span>. After you unzip it, paste your save token. You do not type the address.
        </p>
        <p className="mt-4">
          <Button asChild>
            <a href="/shannon-extension.zip">Download the Chrome extension</a>
          </Button>
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-soft">
          <li>Download the Chrome extension and unzip it.</li>
          <li>Open chrome://extensions or edge://extensions.</li>
          <li>Turn on Developer mode.</li>
          <li>Choose Load unpacked and select the unzipped folder.</li>
          <li>{token ? "Paste the save token below into the button." : "Sign in, then paste your save token into the button."}</li>
          <li>On any page, click Save to Shannon. The shortcut is Ctrl+Shift+S (Command+Shift+S on a Mac). You can also right-click the page.</li>
        </ol>
        <img
          src="/guide/extension-popup.png"
          alt="The Save to Shannon popup after a page is saved"
          className="mt-4 w-full max-w-sm rounded-2xl border border-line"
        />
        {token ? (
          <p className="mt-4 break-all rounded-2xl border border-line bg-card p-4 text-sm">
            <span className="block text-xs uppercase tracking-wide text-ink-soft">Your save token</span>
            <span className="mt-1 block font-mono">{token}</span>
          </p>
        ) : (
          <p className="mt-4 text-sm">
            <Link className="underline" href="/login">
              Sign in
            </Link>{" "}
            to see your save token.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Or drag this to the bookmarks bar</h2>
        <p className="mt-2 text-sm text-ink-soft">On a page you want to keep, click the bookmark. Shannon opens with that page attached.</p>
        <p className="mt-4">
          <BookmarkletLink href={bookmarklet(origin)} />
        </p>
        <p className="mt-2 text-xs text-ink-soft">Drag the button. Clicking it on this page does nothing.</p>
      </section>

      <p className="mt-10">
        <Link className="underline" href={user ? "/app" : "/signup"}>
          {user ? "Continue to your library" : "Open a register"}
        </Link>
      </p>
    </div>
  );
}
