"use client";
import { useEffect, useState } from "react";
import { useActionForm } from "@/components/use-action-form";
import { Button, Field, Input, Notice } from "@/components/ui";
import { FileInput } from "@/components/FileInput";
import type { ActionResult } from "@/app/staff/actions";

export function GradeForm({
  action,
  maxPoints,
  initial,
}: {
  action: (s: ActionResult | undefined, f: FormData) => Promise<ActionResult>;
  maxPoints: number;
  initial: { score: number | null; feedback: string; graded: boolean };
}) {
  const [state, onSubmit, pending] = useActionForm(action);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (state?.ok) setVersion((v) => v + 1);
  }, [state]);
  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="space-y-4" key={version}>
        <Field label={`Score (out of ${maxPoints})`} hint="Leave empty to send only a response.">
          <Input name="score" type="number" min={0} max={maxPoints} step="any" defaultValue={initial.score ?? ""} className="block max-w-40" />
        </Field>
        <Field label="Response to the student" hint="Markdown and $math$ work here.">
          <textarea
            name="feedback"
            defaultValue={initial.feedback}
            rows={6}
            maxLength={20000}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </Field>
        <Field label="Attach files to your response (optional)" hint="e.g. their work with your corrections.">
          <FileInput name="feedbackFiles" />
        </Field>
        <Button pending={pending}>{initial.graded ? "Update grade & response" : "Save grade & response"}</Button>
      </form>
      {state?.error && <Notice tone="bad">{state.error}</Notice>}
      {state?.message && <Notice tone="ok">{state.message}</Notice>}
    </div>
  );
}
