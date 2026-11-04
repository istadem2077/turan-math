"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import { DateTimeInput } from "@/components/LocalTime";
import type { ActionResult } from "@/app/staff/actions";

export function ScheduleForm({
  action,
  label,
  defaultIso,
}: {
  action: (s: ActionResult | undefined, f: FormData) => Promise<ActionResult>;
  label: string;
  defaultIso?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-60">
          <DateTimeInput name="startsAt" defaultIso={defaultIso} required />
        </div>
        <Button variant="secondary" pending={pending}>
          {label}
        </Button>
      </div>
      {state?.error && <p className="anim-fade text-xs text-bad">{state.error}</p>}
    </form>
  );
}
