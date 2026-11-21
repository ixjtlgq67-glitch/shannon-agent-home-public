"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Payload = { url?: string; title?: string; text?: string };

export default function CapturePage() {
  const [state, setState] = useState<"working" | "saved" | "signin" | "error">("working");
  const [reviewPath, setReviewPath] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    if (raw) {
      sessionStorage.setItem("shannon-capture", raw);
      history.replaceState(null, "", "/capture");
    }
    const stored = sessionStorage.getItem("shannon-capture");
    if (!stored) {
      setState("error");
      setMessage("Nothing was attached. Use the bookmark on the page you want to keep.");
      return;
    }
    let payload: Payload;
    try {
      payload = JSON.parse(decodeURIComponent(stored)) as Payload;
    } catch {
      setState("error");
      setMessage("Shannon could not read that bookmark.");
      return;
    }
    fetch("/api/save", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: payload.url, title: payload.title, text: payload.text }),
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as { ok?: boolean; code?: string; reviewPath?: string; message?: string };
        if (response.status === 401) {
          setState("signin");
          return;
        }
        if (!response.ok || !body.ok) {
          setState("error");
          setMessage(body.message || "Shannon could not save that page.");
          return;
        }
        sessionStorage.removeItem("shannon-capture");
        setReviewPath(body.reviewPath || "/app");
        setState("saved");
        setMessage(body.code === "duplicate" ? "Already in your library." : "Saved.");
      })
      .catch(() => {
        setState("error");
        setMessage("Shannon could not save that page.");
      });
  }, []);

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Link href="/" className="font-serif text-2xl">
        Shannon
      </Link>
      <h1 className="mt-8 font-serif text-4xl">{state === "saved" ? "Saved" : state === "signin" ? "Sign in to keep it" : "Saving this page"}</h1>
      <p className="mt-3 text-ink-soft" role="status">
        {state === "working" ? "Saving this page…" : state === "signin" ? "Sign in, and Shannon will bring you back to this page." : message}
      </p>
      {state === "saved" ? (
        <p className="mt-6">
          <Link className="rounded-full bg-seal px-4 py-2 text-sm text-seal-ink" href={reviewPath}>
            View the review
          </Link>
        </p>
      ) : null}
      {state === "signin" ? (
        <p className="mt-6">
          <Link className="underline" href="/login?next=/capture">
            Sign in
          </Link>
        </p>
      ) : null}
    </div>
  );
}
