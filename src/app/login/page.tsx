"use client";
import { useActionForm } from "@/components/use-action-form";
import { login } from "./actions";
import { Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const [state, onSubmit, pending] = useActionForm(login);
  return (
    <main className="grid min-h-screen place-items-center bg-navy px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center text-white">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-white/10 text-xl font-black">T</div>
          <h1 className="text-2xl font-bold">Turan Math</h1>
          <p className="mt-1 text-sm text-white/70">SAT Math practice testing</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-xl">
          <Field label="Username">
            <Input name="username" autoComplete="username" autoCapitalize="none" required autoFocus />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          {state?.error && <p className="anim-fade text-sm text-bad">{state.error}</p>}
          <Button className="w-full" pending={pending}>
            Sign in
          </Button>
          <p className="text-center text-xs text-muted">Accounts are created by your professor.</p>
        </form>
      </div>
    </main>
  );
}
