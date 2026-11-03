/**
 * Quiz timing. The professor starts a quiz by hand (students then get
 * `LOBBY_MINUTES` to join before module 1 opens) or schedules it for a set
 * time. Either way the result is a fixed `startsAt`:
 *
 * Everyone in a quiz begins module 1 at `startsAt`; module 1 closes for
 * everyone `moduleMinutes` later. A student who submits module 1 early starts
 * module 2 immediately; otherwise module 2 starts when module 1 closes.
 * Module 2 lasts `moduleMinutes` from its own start.
 */
export const GRACE_MS = 10_000;
/** Time students get to enter the quiz after the professor presses Start. */
export const LOBBY_MINUTES = 5;

export type QuizTiming = { startsAt: Date | null; moduleMinutes: number };
export type StartedTiming = { startsAt: Date; moduleMinutes: number };

export const moduleMs = (q: QuizTiming) => q.moduleMinutes * 60_000;

function started(q: QuizTiming): StartedTiming {
  if (!q.startsAt) throw new Error("This quiz hasn't been started.");
  return q as StartedTiming;
}

export function module1Deadline(q: QuizTiming): Date {
  return new Date(started(q).startsAt.getTime() + moduleMs(q));
}

/** Latest moment anything can still happen in the quiz. */
export function quizEndsAt(q: QuizTiming): Date {
  return new Date(started(q).startsAt.getTime() + 2 * moduleMs(q));
}

/**
 * NOT_STARTED: the professor hasn't started or scheduled it (students don't see it).
 * LOBBY: starts within the lobby window; students can enter and wait.
 * SCHEDULED: starts later than that.
 */
export type QuizPhase = "NOT_STARTED" | "SCHEDULED" | "LOBBY" | "LIVE" | "FINISHED";

export function quizPhase(q: QuizTiming, now = new Date()): QuizPhase {
  if (!q.startsAt) return "NOT_STARTED";
  if (now < q.startsAt) return q.startsAt.getTime() - now.getTime() <= LOBBY_MINUTES * 60_000 ? "LOBBY" : "SCHEDULED";
  if (now < quizEndsAt(q)) return "LIVE";
  return "FINISHED";
}

export function module2Deadline(q: QuizTiming, module2StartedAt: Date): Date {
  return new Date(module2StartedAt.getTime() + moduleMs(q));
}
