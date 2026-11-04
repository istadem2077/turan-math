"use client";
import { useActionState } from "react";
import { Button, Field, Input, Notice } from "@/components/ui";
import type { ActionResult } from "../actions";

export function RoomForm({
  action,
  initial,
  submitLabel,
}: {
  action: (s: ActionResult | undefined, f: FormData) => Promise<ActionResult>;
  initial: { name: string; description: string };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-5">
      <Field label="Room name">
        <Input name="name" defaultValue={initial.name} required maxLength={120} placeholder="e.g. Group A — Monday/Wednesday" />
      </Field>
      <Field label="Description (optional)" hint="Only staff see this.">
        <textarea
          name="description"
          defaultValue={initial.description}
          maxLength={2000}
          rows={3}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </Field>
      {state?.error && <Notice tone="bad">{state.error}</Notice>}
      {state?.message && <Notice tone="ok">{state.message}</Notice>}
      <Button pending={pending}>{submitLabel}</Button>
    </form>
  );
}
