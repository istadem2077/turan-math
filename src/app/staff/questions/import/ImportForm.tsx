"use client";
import { Button, Notice } from "@/components/ui";
import { useActionForm } from "@/components/use-action-form";
import { importQuestions } from "../../actions";

export function ImportForm() {
  const [state, onSubmit, pending] = useActionForm(importQuestions);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input
        type="file"
        name="file"
        accept=".json,.csv,application/json,text/csv"
        required
        className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand-dark"
      />
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input type="checkbox" name="update" className="mt-0.5" />
        <span>
          <span className="font-medium">Update questions that already exist</span>
          <span className="block text-xs text-muted">
            Same externalId: replace text, answers, skill, difficulty and active/inactive with the file&apos;s version. Use this when importing a newer
            export. Otherwise existing questions are skipped.
          </span>
        </span>
      </label>
      <Button pending={pending}>Import</Button>
      {state && "error" in state && state.error && <Notice tone="bad">{state.error}</Notice>}
      {state && "total" in state && (
        <div className="space-y-3">
          <Notice tone={state.errorCount ? "warn" : "ok"}>
            {state.total} rows read · {state.inserted} imported · {state.updated} updated · {state.skipped} already there (skipped) · {state.errorCount}{" "}
            invalid{state.figures ? ` · ${state.figures} figures stored` : ""}
          </Notice>
          {state.errors && state.errors.length > 0 && (
            <ul className="max-h-64 overflow-y-auto rounded-lg border border-line bg-white p-3 text-xs">
              {state.errors.map((e) => (
                <li key={e.row} className="py-0.5">
                  <span className="font-semibold">Row {e.row}:</span> {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
