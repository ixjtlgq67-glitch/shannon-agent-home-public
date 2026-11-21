import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h1 className="font-serif text-3xl">That run is not in your register</h1>
      <p className="mt-3 text-sm text-ink-soft">It may belong to another reader, or it may never have been saved.</p>
      <Link className="mt-4 inline-block underline" href="/app">
        Back to save
      </Link>
    </div>
  );
}
