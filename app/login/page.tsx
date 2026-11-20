import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AuthFrame } from "@/components/auth-frame";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/actions";
import { isSupabaseConfigured } from "@/lib/config";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "";
  const demo = !isSupabaseConfigured();
  return (
    <AuthFrame
      title="Sign back in"
      lede="Your accepted judgments stay. The panel does not."
      alternate={{ href: "/signup", label: "Open a register" }}
    >
      {params.error ? (
        <p role="alert" className="mb-4 text-sm text-seal">
          {params.error}
        </p>
      ) : null}
      <ActionForm action={signIn} className="grid gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <SubmitButton pendingLabel="Checking…">Sign in</SubmitButton>
      </ActionForm>
      {demo ? (
        <p className="mt-4 text-sm text-ink-soft">
          An optional confirmation note stays in the <Link className="underline" href="/inbox">local inbox</Link>. You can use the library without it.
        </p>
      ) : null}
    </AuthFrame>
  );
}
