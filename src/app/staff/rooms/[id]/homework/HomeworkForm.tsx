"use client";
import { useEffect, useState } from "react";
import { useActionForm } from "@/components/use-action-form";
import { Button, Field, Input, Notice } from "@/components/ui";
import { DateTimeInput } from "@/components/LocalTime";
import { Toggle } from "@/components/client-ui";
import { FileInput } from "@/components/FileInput";
import { FORMAT_PRESETS } from "@/lib/file-formats";
import type { ActionResult } from "@/app/staff/actions";

export type HomeworkFormValues = {
  title: string;
  instructions: string;
  dueAt?: string;
  maxPoints: number;
  allowLate: boolean;
  allowedFormats: string[];
};

export function HomeworkForm({
  action,
  initial,
  submitLabel,
}: {
  action: (s: ActionResult | undefined, f: FormData) => Promise<ActionResult>;
  initial: HomeworkFormValues;
  submitLabel: string;
}) {
  const [state, onSubmit, pending] = useActionForm(action);
  // Re-mount after a successful save so the file picker clears.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (state?.ok) setVersion((v) => v + 1);
  }, [state]);

  const checked = FORMAT_PRESETS.filter((p) => p.exts.every((e) => initial.allowedFormats.includes(e)));
  const covered = new Set(checked.flatMap((p) => p.exts));
  const other = initial.allowedFormats.filter((e) => !covered.has(e)).join(", ");

  return (
    <form onSubmit={onSubmit} className="space-y-5" key={version}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title" className="md:col-span-2">
          <Input name="title" defaultValue={initial.title} required maxLength={160} placeholder="e.g. Homework 4 — Systems of equations" />
        </Field>
        <Field label="Due" hint="In your local time.">
          <DateTimeInput name="dueAt" defaultIso={initial.dueAt} required />
        </Field>
        <Field label="Points">
          <Input name="maxPoints" type="number" min={1} max={1000} defaultValue={initial.maxPoints} required />
        </Field>
      </div>
      <Field label="Instructions" hint="Markdown; math with $x^2$ or $$\frac{a}{b}$$.">
        <textarea
          name="instructions"
          defaultValue={initial.instructions}
          rows={6}
          maxLength={20000}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Accepted file formats for student submissions</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {FORMAT_PRESETS.map((p) => (
            <label key={p.key} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" name="formats" value={p.key} defaultChecked={checked.includes(p)} />
              {p.label}
            </label>
          ))}
        </div>
        <Input name="otherFormats" defaultValue={other} placeholder="Other extensions, e.g. ggb, py" className="max-w-sm" />
        <span className="block text-xs text-muted">Leave everything empty to accept any file type.</span>
      </fieldset>
      <Toggle
        name="allowLate"
        checked={initial.allowLate}
        label="Accept late submissions"
        hint="When off, students can't hand in after the due date. Late hand-ins are marked as late."
      />
      <Field label="Attach files to the assignment (optional)" hint="e.g. the worksheet as a PDF. Students in this room can download them.">
        <FileInput name="attachments" />
      </Field>
      {state?.error && <Notice tone="bad">{state.error}</Notice>}
      {state?.message && <Notice tone="ok">{state.message}</Notice>}
      <Button pending={pending}>{submitLabel}</Button>
    </form>
  );
}
