import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthFrame } from "@/components/auth-frame";
import { signUp } from "@/lib/actions";
import { isSupabaseConfigured } from "@/lib/config";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const params = await searchParams;
  const demo = !isSupabaseConfigured();
  return (
    <AuthFrame
      title="Open a register in your name"
      lede="You can save a page as soon as the register exists. Confirming the email can wait."
      alternate={{ href: "/login", label: "I already have a register" }}
    >
      {params.error ? (
        <p role="alert" className="mb-4 text-sm text-seal">
          {params.error}
        </p>
      ) : null}
      {params.sent ? (
        <p className="mb-4 rounded-xl bg-paper-2 p-3 text-sm" role="status">
          If this project still requires a confirmation email, open that link, then sign in. Turning off Confirm email in Supabase skips this step.
        </p>
      ) : null}
      <ActionForm action={signUp} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Name that will sign decisions</Label>
          <Input id="name" name="name" autoComplete="name" required minLength={2} placeholder="Qi Liu" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        <SubmitButton pendingLabel="Sending the note…">Create the register</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-sm text-ink-soft">
        {demo
          ? "No email is required to start. An optional confirmation note stays in the local inbox."
          : "With Confirm email off, this opens the library immediately. The confirmation link still works if you leave it on."}{" "}
        <Link className="underline" href="/help">
          How verification works
        </Link>
      </p>
    </AuthFrame>
  );
}
