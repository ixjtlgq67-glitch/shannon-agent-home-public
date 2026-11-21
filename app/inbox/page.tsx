import type { ReactNode } from "react";
import Link from "next/link";
import { pendingUserId } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/config";
import { getMemoryStore } from "@/lib/store/memory";

export default async function InboxPage() {
  if (isSupabaseConfigured()) {
    return (
      <Frame>
        <h1 className="font-serif text-4xl">Email is sent by Supabase</h1>
        <p className="mt-3 text-ink-soft">This local inbox is only for demo mode. Check the address you signed up with.</p>
      </Frame>
    );
  }
  const userId = await pendingUserId();
  const mail = userId ? await getMemoryStore().mailboxFor(userId) : [];
  return (
    <Frame>
      <h1 className="font-serif text-4xl">Local inbox</h1>
      <p className="mt-3 text-ink-soft">
        Demo mode cannot send mail. This note exists only in the local store, and only for the browser that just signed up.
      </p>
      {mail.length === 0 ? (
        <p className="mt-8 text-sm">
          Nothing here. <Link className="underline" href="/signup">Open a register</Link> first.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {mail.map((item) => (
            <li key={item.id} className="rounded-2xl border border-line bg-card p-5">
              <p className="text-xs uppercase tracking-wide text-ink-soft">To {item.to}</p>
              <h2 className="mt-2 font-serif text-2xl">{item.subject}</h2>
              <p className="mt-3 text-sm leading-relaxed">{item.body}</p>
              <Link className="mt-4 inline-block rounded-full bg-seal px-4 py-2 text-sm text-seal-ink" href={`/auth/confirm?token=${item.token}`}>
                Confirm this address
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <Link href="/" className="font-serif text-2xl">
        Shannon
      </Link>
      <div className="mt-8">{children}</div>
    </div>
  );
}
