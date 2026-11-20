"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/actions";
import { SAMPLE_TEXT, SAMPLE_TITLE } from "@/lib/shannon/sample";

export function SaveForm({ action }: { action: (prev: FormState, formData: FormData) => Promise<FormState> }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");

  return (
    <ActionForm action={action} className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">Save a page address. If the site will not give up its text, paste the passage and Shannon keeps the link.</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setTitle(SAMPLE_TITLE);
            setText(SAMPLE_TEXT);
            setUrl("");
          }}
        >
          Load the Harbor Line notes
        </Button>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="title">Title you will search for later</Label>
        <Input id="title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional if the page has a title" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="url">URL, optional</Label>
        <Input id="url" name="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/essay" inputMode="url" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="text">Passage</Label>
        <Textarea id="text" name="text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste the paragraphs you actually want judged." />
      </div>
      <div>
        <SubmitButton pendingLabel="Freezing the source…">Save and run the panel</SubmitButton>
      </div>
    </ActionForm>
  );
}
