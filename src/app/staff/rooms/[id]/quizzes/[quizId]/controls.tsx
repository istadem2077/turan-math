"use client";
import { useActionForm } from "@/components/use-action-form";
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
  const [state, onSubmit, pending] = useActionForm(action);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
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
