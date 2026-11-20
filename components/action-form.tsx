"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/actions";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "default",
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel: string;
  variant?: "default" | "outline" | "ghost";
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name={name} value={value} variant={variant} disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, { error: "" });
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error ? (
        <p role="alert" className="text-sm text-seal">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
