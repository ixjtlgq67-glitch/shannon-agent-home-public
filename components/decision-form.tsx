"use client";

import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/lib/actions";

export function DecisionForm({
  action,
  proposalId,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  proposalId: string;
}) {
  return (
    <ActionForm action={action} className="grid gap-3 border-t border-line pt-4">
      <input type="hidden" name="proposal_id" value={proposalId} />
      <div className="grid gap-2">
        <Label htmlFor={`reason-${proposalId}`}>If you reject it, one line is enough</Label>
        <Input id={`reason-${proposalId}`} name="reason" maxLength={200} placeholder="Optional. Kept in the audit log, not the register." />
      </div>
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="accept" pendingLabel="Saving…">
          Accept into the register
        </SubmitButton>
        <SubmitButton name="decision" value="reject" variant="outline" pendingLabel="Saving…">
          Reject
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
