"use client";
import { useActionState } from "react";
import { Button, Input, Notice } from "@/components/ui";
import { generateTest } from "../actions";

export function GenerateForm() {
  const [state, action, pending] = useActionState(generateTest, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input name="title" required maxLength={120} placeholder="Test title, e.g. Mock test — November 10" />
        <Button pending={pending} className="shrink-0">
          Generate random test
        </Button>
      </div>
      {state?.error && <Notice tone="bad">{state.error}</Notice>}
    </form>
  );
}
