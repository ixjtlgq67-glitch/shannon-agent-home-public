import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { headers } from "next/headers";
import { appOrigin } from "@/lib/config";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const token = await (await getStore()).ensureSaveToken(user.id);
  const origin = appOrigin(await headers());
  return (
    <div className="grid max-w-xl gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-brass">Settings</p>
        <h1 className="mt-2 font-serif text-4xl">Save token</h1>
        <p className="mt-3 text-ink-soft">
          The browser button uses this token when it cannot see your signed-in session. A copy downloaded from this site already uses {origin}. Paste the token. You do not type the address.
        </p>
      </div>
      <p className="break-all rounded-2xl border border-line bg-card p-4 font-mono text-sm">{token}</p>
      <p className="text-sm">
        <Link className="underline" href="/get-the-button">
          Install the save button
        </Link>
      </p>
    </div>
  );
}
