import type { ReactNode } from "react";
import Link from "next/link";

export function AuthFrame({
  title,
  lede,
  alternate,
  children,
}: {
  title: string;
  lede: string;
  alternate: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-4 py-10 md:grid-cols-2">
      <div>
        <Link href="/" className="font-serif text-2xl">
          Shannon
        </Link>
        <h1 className="mt-8 font-serif text-4xl leading-tight">{title}</h1>
        <p className="mt-3 text-ink-soft">{lede}</p>
      </div>
      <div className="rounded-3xl border border-line bg-card p-6">
        {children}
        <p className="mt-6 text-sm">
          <Link className="underline" href={alternate.href}>
            {alternate.label}
          </Link>
        </p>
      </div>
    </div>
  );
}
