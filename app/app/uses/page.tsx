import { ActionForm, SubmitButton } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveDeclaredUse } from "@/lib/actions";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

export default async function UsesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const store = await getStore();
  const uses = await store.listUses(user.id);
  const register = await store.listRegister(user.id);

  return (
    <div className="grid gap-8">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-brass">Declared uses</p>
        <h1 className="mt-2 font-serif text-4xl">What the panel is for</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Roles are the uses you declare, plus a standing Skeptic that never reads this page. Historian is seeded to wait until you have accepted a judgment. Taste is plain language you can edit. Nothing is fine-tuned.
        </p>
      </div>
      <ul className="grid gap-4">
        {uses.map((use) => {
          const kept = register.filter((entry) => entry.use_id === use.use_id);
          const suggestion = kept.length
            ? `You have accepted ${kept.length} for this use. Latest judgment: ${kept[0].judgment}`
            : "No accepted judgment for this use yet, so there is nothing to distill.";
          return (
            <li key={use.use_id} className="rounded-3xl border border-line bg-card p-5">
              <ActionForm action={saveDeclaredUse} className="grid gap-3">
                <input type="hidden" name="use_id" value={use.use_id} />
                <input type="hidden" name="mode" value="edit" />
                <h2 className="font-serif text-2xl capitalize">{use.use_id}</h2>
                <div className="grid gap-2">
                  <Label htmlFor={`desc-${use.use_id}`}>What this use is asking</Label>
                  <Textarea id={`desc-${use.use_id}`} name="description" defaultValue={use.description} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`taste-${use.use_id}`}>Taste, in your words</Label>
                  <Textarea id={`taste-${use.use_id}`} name="taste_profile" defaultValue={use.taste_profile} placeholder="Prefer concrete limits over sweeping claims." />
                </div>
                <p className="text-sm text-ink-soft">From your decisions: {suggestion}</p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="enabled" defaultChecked={use.enabled} />
                  Include this use when triage recommends it
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="requires_history" defaultChecked={use.requires_history} />
                  Run only after I have accepted history
                </label>
                <div>
                  <SubmitButton pendingLabel="Saving…">Save this use</SubmitButton>
                </div>
              </ActionForm>
            </li>
          );
        })}
      </ul>
      <section className="rounded-3xl border border-line bg-card p-5">
        <h2 className="font-serif text-2xl">Add a use</h2>
        <ActionForm action={saveDeclaredUse} className="mt-4 grid gap-3">
          <input type="hidden" name="mode" value="add" />
          <div className="grid gap-2">
            <Label htmlFor="new-id">Id</Label>
            <Input id="new-id" name="use_id" placeholder="teaching" required pattern="[a-z][a-z0-9-]{1,32}" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-desc">Description</Label>
            <Textarea id="new-desc" name="description" required placeholder="Prepare a session about human oversight." />
          </div>
          <input type="hidden" name="taste_profile" value="" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="enabled" defaultChecked />
            Enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requires_history" />
            Requires accepted history
          </label>
          <div>
            <SubmitButton pendingLabel="Adding…">Add use</SubmitButton>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
