"use client";
import { startTransition, useActionState, type FormEvent } from "react";

/**
 * Like useActionState, but returns an onSubmit handler instead of a form
 * action. React 19 clears every field of a <form action={…}> after each
 * submission, even when the server answers with an error, so users would
 * lose what they typed. Submitting through onSubmit keeps the fields; forms
 * that should clear after a successful save re-mount themselves (key).
 *
 *   const [state, onSubmit, pending] = useActionForm(saveThing);
 *   <form onSubmit={onSubmit}>…</form>
 *
 * `confirm` (optional) runs first; return false to cancel the submission.
 */
export function useActionForm<S>(action: (state: S | undefined, form: FormData) => Promise<S>, confirm?: () => boolean) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (confirm && !confirm()) return;
    const form = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(form));
  };
  return [state, onSubmit, pending] as const;
}
