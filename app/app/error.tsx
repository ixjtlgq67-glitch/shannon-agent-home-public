"use client";

export default function ProductError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-3xl border border-line bg-card p-6">
      <h1 className="font-serif text-3xl">That page did not load</h1>
      <p className="mt-3 text-sm text-ink-soft">{error.message || "Something in the register failed."}</p>
      <button className="mt-4 rounded-full bg-seal px-4 py-2 text-sm text-seal-ink" type="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
