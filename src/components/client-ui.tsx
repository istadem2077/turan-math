"use client";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { Button, Field, Input, Notice, cx } from "./ui";
import type { ActionResult } from "@/app/staff/actions";

/** Button that runs a server action, optionally behind a confirm(). */
export function ActionButton({
  action,
  confirm: confirmText,
  children,
  variant = "secondary",
  className,
}: {
  action: () => Promise<unknown>;
  confirm?: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <span className="inline-flex flex-col">
      <Button
        type="button"
        variant={variant}
        className={className}
        pending={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          setError(undefined);
          start(async () => {
            try {
              await action();
            } catch (e) {
              if (e && typeof e === "object" && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
              setError(e instanceof Error ? e.message : "Failed");
            }
          });
        }}
      >
        {children}
      </Button>
      {error && <span className="anim-fade mt-1 text-xs text-bad">{error}</span>}
    </span>
  );
}

/** Shows freshly created / reset credentials once. */
export function Credentials({ username, password }: { username: string; password: string }) {
  const text = `Username: ${username}\nPassword: ${password}`;
  const [copied, setCopied] = useState(false);
  return (
    <div className="anim-fade rounded-lg border border-ok/30 bg-ok-soft p-4 text-sm">
      <p className="font-semibold text-ok">Share these credentials now. The password won't be shown again.</p>
      <pre className="mt-2 rounded bg-white px-3 py-2 font-mono text-ink">{text}</pre>
      <button
        type="button"
        className="mt-2 text-xs font-semibold text-ok underline"
        onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}
      >
        {copied ? "Copied" : "Copy to clipboard"}
      </button>
    </div>
  );
}

export function CreateUserForm({
  action,
  noun,
  rooms,
}: {
  action: (s: ActionResult | undefined, f: FormData) => Promise<ActionResult>;
  noun: string;
  rooms?: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <div className="space-y-4">
      <form action={formAction} className="grid gap-4 md:grid-cols-2" key={state?.ok ? state.username : "form"}>
        <Field label="Full name">
          <Input name="fullName" required maxLength={100} />
        </Field>
        <Field label="Username" hint="Lowercase letters, digits, . _ -">
          <Input name="username" required pattern="[A-Za-z0-9._\-]{3,32}" autoCapitalize="none" />
        </Field>
        <Field label="Password" hint="Leave empty to generate one">
          <Input name="password" type="text" minLength={6} autoComplete="new-password" />
        </Field>
        {rooms && (
          <Field label="Add to room (optional)">
            <select name="roomId" className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm">
              <option value="">— None —</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="md:col-span-2">
          <Button pending={pending}>{`Create ${noun}`}</Button>
        </div>
      </form>
      {state?.error && <Notice tone="bad">{state.error}</Notice>}
      {state?.ok && state.password && <Credentials username={state.username!} password={state.password} />}
    </div>
  );
}

export function ResetPasswordButton({ action }: { action: () => Promise<ActionResult> }) {
  const [creds, setCreds] = useState<ActionResult>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <Button
        variant="secondary"
        pending={pending}
        onClick={() => {
          if (!window.confirm("Generate a new password? The old one stops working immediately.")) return;
          start(async () => setCreds(await action()));
        }}
      >
        Reset password
      </Button>
      {creds?.password && <Credentials username={creds.username!} password={creds.password} />}
    </div>
  );
}

export function Toggle({ checked, name, label, hint }: { checked?: boolean; name: string; label: string; hint?: string }) {
  const [on, setOn] = useState(!!checked);
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" name={name} checked={on} onChange={(e) => setOn(e.target.checked)} className="peer sr-only" />
      <span className={cx("relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40", on ? "bg-brand" : "bg-line")}>
        <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", on ? "left-4.5" : "left-0.5")} />
      </span>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}
