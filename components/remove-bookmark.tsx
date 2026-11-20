"use client";

import { useFormStatus } from "react-dom";

export function RemoveBookmark({ action, sourceId }: { action: (formData: FormData) => Promise<void>; sourceId: string }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Remove this site from your library? Judgments you already accepted stay in the register.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="source_id" value={sourceId} />
      <RemoveButton />
    </form>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="text-sm text-ink-soft underline" disabled={pending}>
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
