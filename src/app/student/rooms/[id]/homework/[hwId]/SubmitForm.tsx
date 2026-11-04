"use client";
import { useActionState, useEffect, useState } from "react";
import { Button, Field, Notice } from "@/components/ui";
import { FileInput } from "@/components/FileInput";
import { submitHomework, type SubmitResult } from "@/app/student/actions";

export function SubmitForm({ homeworkId, formats, resubmit }: { homeworkId: string; formats: string[]; resubmit: boolean }) {
  const [state, formAction, pending] = useActionState<SubmitResult | undefined, FormData>(submitHomework.bind(null, homeworkId), undefined);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (state?.ok) setVersion((v) => v + 1);
  }, [state]);
  return (
    <div className="space-y-4">
      <form
        action={formAction}
        className="space-y-4"
        key={version}
        onSubmit={(e) => {
          if (resubmit && !window.confirm("Replace your previous hand-in with these files?")) e.preventDefault();
        }}
      >
        <Field label="Files">
          <FileInput name="files" formats={formats} required />
        </Field>
        <Field label="Note to your professor (optional)">
          <textarea
            name="note"
            rows={3}
            maxLength={5000}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </Field>
        <Button pending={pending}>{resubmit ? "Replace hand-in" : "Hand in"}</Button>
      </form>
      {state?.error && <Notice tone="bad">{state.error}</Notice>}
      {state?.message && <Notice tone="ok">{state.message}</Notice>}
    </div>
  );
}
