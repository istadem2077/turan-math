"use client";
import { useEffect, useState } from "react";
import { useActionForm } from "@/components/use-action-form";
import { Button, Field, Input, Notice } from "@/components/ui";
import { FileInput } from "@/components/FileInput";
import { MATERIAL_FORMATS, MATERIAL_MAX_FILE_BYTES } from "@/lib/file-formats";
import type { ActionResult } from "@/app/staff/actions";

export function MaterialForm({
  action,
  initial,
  submitLabel,
}: {
  action: (s: ActionResult | undefined, f: FormData) => Promise<ActionResult>;
  initial: { title: string; description: string; url: string };
  submitLabel: string;
}) {
  const [state, onSubmit, pending] = useActionForm(action);
  // Re-mount after a successful save so the file picker clears.
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (state?.ok) setVersion((v) => v + 1);
  }, [state]);
  return (
    <form onSubmit={onSubmit} className="space-y-5" key={version}>
      <Field label="Title">
        <Input name="title" defaultValue={initial.title} required maxLength={160} placeholder="e.g. Lecture 5 — Quadratic functions" />
      </Field>
      <Field label="Description (optional)" hint="Markdown; math with $x^2$.">
        <textarea
          name="description"
          defaultValue={initial.description}
          rows={3}
          maxLength={20000}
          className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </Field>
      <Field label="Files" hint="Slides or documents: PDF, PowerPoint, Word.">
        <FileInput name="files" formats={MATERIAL_FORMATS} maxFileBytes={MATERIAL_MAX_FILE_BYTES} />
      </Field>
      <Field label="Link (optional)" hint="e.g. Google Slides, a shared drive folder or a video. Files, a link, or both.">
        <Input name="url" type="url" defaultValue={initial.url} maxLength={2000} placeholder="https://…" />
      </Field>
      {state?.error && <Notice tone="bad">{state.error}</Notice>}
      {state?.message && <Notice tone="ok">{state.message}</Notice>}
      <Button pending={pending}>{submitLabel}</Button>
    </form>
  );
}
