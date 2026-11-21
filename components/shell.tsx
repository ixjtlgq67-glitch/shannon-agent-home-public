import type { ReactNode } from "react";
import Link from "next/link";
import { signOut } from "@/lib/actions";
import type { SessionUser } from "@/lib/auth";

const LINKS = [
  { href: "/app", label: "Save" },
  { href: "/app/register", label: "Register" },
  { href: "/app/chat", label: "Ask" },
  { href: "/app/ledger", label: "Ledger" },
  { href: "/app/uses", label: "Uses" },
  { href: "/help", label: "Help" },
  { href: "/app/settings", label: "Settings" },
];

export function Shell({
  user,
  modeLabel,
  showSignOut = true,
  children,
}: {
  user: SessionUser;
  modeLabel: string;
  showSignOut?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-card/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <Link href="/app" className="font-serif text-2xl tracking-tight">
            Shannon
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-ink-soft">{user.displayName}</span>
            {showSignOut ? (
              <form action={signOut}>
                <button className="rounded-full border border-line px-3 py-1.5 hover:bg-paper-2" type="submit">
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-3 text-sm">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-full px-3 py-1.5 text-ink-soft hover:bg-paper-2 hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <p className="border-b border-line bg-paper-2 px-4 py-2 text-center text-xs text-ink-soft">{modeLabel}</p>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
