"use client";
import { useActionState, useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { DateTimeInput } from "@/components/LocalTime";
import { Toggle } from "@/components/client-ui";
import { LOBBY_MINUTES } from "@/lib/timing";
import type { ActionResult } from "@/app/staff/actions";

export type QuizFormValues = {
  title: string;
  moduleMinutes: number;
  calculatorAllowed: boolean;
  testId: string | null;
};

export function QuizForm({
  action,
  initial,
  tests,
  submitLabel,
  testLocked,
  withSchedule,
}: {
  action: (s: ActionResult | undefined, f: FormData) => Promise<ActionResult>;
  initial: QuizFormValues;
  tests: { id: string; title: string; source: string }[];
  submitLabel: string;
  /** Students have started: the test can't change. */
  testLocked?: boolean;
  /** New quiz: offer the optional schedule. */
  withSchedule?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [schedule, setSchedule] = useState(false);
  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Title">
          <Input name="title" defaultValue={initial.title} required maxLength={120} placeholder="e.g. Quiz 3 — Linear functions" />
        </Field>
        <Field label="Test" hint={testLocked ? "Locked: students have started." : "Generate or build tests on the Tests page."}>
          {testLocked ? (
            <>
              <Select disabled value={initial.testId ?? ""}>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
              <input type="hidden" name="testId" value={initial.testId ?? ""} />
            </>
          ) : (
            <Select name="testId" defaultValue={initial.testId ?? ""}>
              <option value="">— Choose later —</option>
              {tests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.source === "AUTO" ? "random" : "hand-picked"})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Minutes per module" hint="Default: 27. Each quiz has 2 modules.">
          <Input name="moduleMinutes" type="number" min={1} max={180} defaultValue={initial.moduleMinutes} required />
        </Field>
      </div>
      <Toggle
        name="calculatorAllowed"
        checked={initial.calculatorAllowed}
        label="Allow Desmos graphing calculator"
        hint="When off, the calculator button is hidden during the quiz."
      />
      {withSchedule && (
        <div className="space-y-3 rounded-lg border border-line bg-canvas p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="schedule" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} className="mt-1" />
            <span>
              <span className="block text-sm font-medium">Schedule a start time (optional)</span>
              <span className="block text-xs text-muted">
                Otherwise the quiz waits until you press <b>Start quiz</b>; students then have {LOBBY_MINUTES} minutes to join before it begins.
              </span>
            </span>
          </label>
          {schedule && (
            <Field label="Starts at" hint="Module 1 opens for everyone at this moment.">
              <DateTimeInput name="startsAt" required />
            </Field>
          )}
        </div>
      )}
      {state?.error && <Notice tone="bad">{state.error}</Notice>}
      {state?.message && <Notice tone="ok">{state.message}</Notice>}
      <Button pending={pending}>{submitLabel}</Button>
    </form>
  );
}
