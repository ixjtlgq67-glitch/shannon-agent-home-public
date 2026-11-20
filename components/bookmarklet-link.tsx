"use client";

import { useEffect, useRef } from "react";

export function BookmarkletLink({ href }: { href: string }) {
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    link.current?.setAttribute("href", href);
  }, [href]);
  return (
    <a
      ref={link}
      className="inline-block rounded-full bg-seal px-4 py-2 text-sm text-seal-ink"
      href="#save-to-shannon"
      onClick={(event) => event.preventDefault()}
    >
      Save to Shannon
    </a>
  );
}
