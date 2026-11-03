"use client";
import { useActionState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";
import { DateTimeInput } from "@/components/LocalTime";
import { Toggle } from "@/components/client-ui";
import type { ActionResult } from "../actions";

export type RoomFormValues = {
  name: string;
  startsAt?: string;
  moduleMinutes: number;
  calculatorAllowed: boolean;
  testId: string | null;
};

export function RoomForm({
  action,
  initial,
  tests,
  submitLabel,
  locked,
}: {
  action: (s: ActionResult | undefined, f: FormData) => Promise<ActionResult>;
  initial: RoomFormValues;
  tests: { id: string; title: string; source: string }[];
  submitLabel: string;
  locked?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Room name">
          <Input name="name" defaultValue={initial.name} required maxLength={120} placeholder="e.g. Group A — Mock test 3" />
        </Field>
        <Field label="Start time" hint={locked ? "Locked: students have started." : "Everyone starts module 1 at this moment."}>
          {locked ? (
            <>
              <Input disabled value={initial.startsAt ? new Date(initial.startsAt).toLocaleString() : ""} />
              <input type="hidden" name="startsAt" value={initial.startsAt} />
            </>
          ) : (
            <DateTimeInput name="startsAt" defaultIso={initial.startsAt} required />
          )}
        </Field>
        <Field label="Test" hint={locked ? "Locked: students have started." : "Generate or build tests on the Tests page."}>
          {locked ? (
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
        <Field label="Minutes per module" hint="Bluebook-style default: 22">
          <Input name="moduleMinutes" type="number" min={1} max={180} defaultValue={initial.moduleMinutes} required />
        </Field>
      </div>
      <Toggle
        name="calculatorAllowed"
        checked={initial.calculatorAllowed}
        label="Allow Desmos graphing calculator"
        hint="When off, the calculator button is hidden during the test."
      />
      {state?.error && <Notice tone="bad">{state.error}</Notice>}
      {state?.message && <Notice tone="ok">{state.message}</Notice>}
      <Button disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
    </form>
  );
}
