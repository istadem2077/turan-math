"use client";
import { useActionState } from "react";
import { Button, Notice } from "@/components/ui";
import { importQuestions } from "../../actions";

export function ImportForm() {
  const [state, action, pending] = useActionState(importQuestions, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="file" name="file" accept=".json,.csv,application/json,text/csv" required className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand-dark" />
      <Button disabled={pending}>{pending ? "Importing…" : "Import"}</Button>
      {state && "error" in state && state.error && <Notice tone="bad">{state.error}</Notice>}
      {state && "total" in state && (
        <div className="space-y-3">
          <Notice tone={state.errorCount ? "warn" : "ok"}>
            {state.total} rows read · {state.inserted} imported · {state.duplicates} duplicates skipped · {state.errorCount} invalid
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
