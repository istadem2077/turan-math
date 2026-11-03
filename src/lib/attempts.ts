import "server-only";
import { db } from "./db";
import { estimateScaled, isCorrect } from "./grading";
import { GRACE_MS, module1Deadline, module2Deadline, quizEndsAt, type QuizTiming } from "./timing";
import type { Attempt } from "@/generated/prisma/client";

type AttemptWithQuiz = Attempt & { quiz: QuizTiming };

/**
 * Applies any time-based transitions that are due (module 1 closing, module 2
 * closing). Timers are enforced here on the server; the client clock is only
 * a display.
 */
export async function reconcileAttempt(attempt: AttemptWithQuiz, now = new Date()): Promise<Attempt> {
  let a: Attempt = attempt;
  const m1End = module1Deadline(attempt.quiz);
  if (a.status === "MODULE_1" && now.getTime() > m1End.getTime() + GRACE_MS) {
    a = await db.attempt.update({
      where: { id: a.id },
      data: { status: "MODULE_2", module1SubmittedAt: m1End, module2StartedAt: m1End },
    });
  }
  if (a.status === "MODULE_2" && a.module2StartedAt) {
    const m2End = module2Deadline(attempt.quiz, a.module2StartedAt);
    if (now.getTime() > m2End.getTime() + GRACE_MS) a = await finalizeAttempt(a.id, m2End);
  }
  return a;
}

export async function reconcileQuizAttempts(quizId: string) {
  const attempts = await db.attempt.findMany({
    where: { quizId, status: { not: "SUBMITTED" } },
    include: { quiz: true },
  });
  for (const a of attempts) await reconcileAttempt(a);
}

/** Grades every response and closes the attempt. Idempotent. */
export async function finalizeAttempt(attemptId: string, submittedAt = new Date()): Promise<Attempt> {
  return db.$transaction(async (tx) => {
    const attempt = await tx.attempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: { quiz: { include: { test: { include: { items: { include: { question: true } } } } } }, responses: true },
    });
    if (attempt.status === "SUBMITTED") return attempt;
    const items = attempt.quiz.test?.items ?? [];
    const byItem = new Map(attempt.responses.map((r) => [r.testItemId, r]));
    const raw = [0, 0];
    for (const item of items) {
      const resp = byItem.get(item.id);
      const ok = isCorrect(item.question, resp?.answer);
      if (ok) raw[item.module - 1]++;
      if (resp) await tx.response.update({ where: { id: resp.id }, data: { isCorrect: ok } });
    }
    const total = raw[0] + raw[1];
    return tx.attempt.update({
      where: { id: attemptId },
      data: {
        status: "SUBMITTED",
        module1SubmittedAt: attempt.module1SubmittedAt ?? submittedAt,
        module2StartedAt: attempt.module2StartedAt ?? submittedAt,
        module2SubmittedAt: submittedAt,
        module1Raw: raw[0],
        module2Raw: raw[1],
        rawScore: total,
        scaledScore: estimateScaled(total, items.length || 44),
      },
    });
  });
}

/** Returns the student's attempt, creating it once module 1 has opened. */
export async function getOrStartAttempt(roomId: string, quizId: string, studentId: string, now = new Date()) {
  // Only quizzes in a room the student belongs to.
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, roomId, room: { members: { some: { studentId } } } },
  });
  if (!quiz) return { error: "NOT_FOUND" as const };
  if (!quiz.startsAt) return { error: "NOT_OPEN" as const, quiz };
  if (!quiz.testId) return { error: "NO_TEST" as const, quiz };

  const existing = await db.attempt.findUnique({
    where: { quizId_studentId: { quizId, studentId } },
    include: { quiz: true },
  });
  if (existing) return { quiz, attempt: await reconcileAttempt(existing, now) };

  if (now < quiz.startsAt!) return { error: "NOT_STARTED" as const, quiz };
  if (now >= quizEndsAt(quiz)) return { error: "CLOSED" as const, quiz };

  const created = await db.attempt.upsert({
    where: { quizId_studentId: { quizId, studentId } },
    update: {},
    create: { quizId, studentId, module1StartedAt: now },
    include: { quiz: true },
  });
  return { quiz, attempt: await reconcileAttempt(created, now) };
}

export function currentDeadline(quiz: QuizTiming, attempt: Attempt): Date | null {
  if (attempt.status === "MODULE_1") return module1Deadline(quiz);
  if (attempt.status === "MODULE_2" && attempt.module2StartedAt) return module2Deadline(quiz, attempt.module2StartedAt);
  return null;
}
