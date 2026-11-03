import "server-only";
import { db } from "./db";
import { estimateScaled, isCorrect } from "./grading";
import { GRACE_MS, module1Deadline, module2Deadline, roomEndsAt, type RoomTiming } from "./timing";
import type { Attempt } from "@/generated/prisma/client";

type AttemptWithRoom = Attempt & { room: RoomTiming };

/**
 * Applies any time-based transitions that are due (module 1 closing, module 2
 * closing). Timers are enforced here on the server; the client clock is only
 * a display.
 */
export async function reconcileAttempt(attempt: AttemptWithRoom, now = new Date()): Promise<Attempt> {
  let a: Attempt = attempt;
  const m1End = module1Deadline(attempt.room);
  if (a.status === "MODULE_1" && now.getTime() > m1End.getTime() + GRACE_MS) {
    a = await db.attempt.update({
      where: { id: a.id },
      data: { status: "MODULE_2", module1SubmittedAt: m1End, module2StartedAt: m1End },
    });
  }
  if (a.status === "MODULE_2" && a.module2StartedAt) {
    const m2End = module2Deadline(attempt.room, a.module2StartedAt);
    if (now.getTime() > m2End.getTime() + GRACE_MS) a = await finalizeAttempt(a.id, m2End);
  }
  return a;
}

export async function reconcileRoomAttempts(roomId: string) {
  const attempts = await db.attempt.findMany({
    where: { roomId, status: { not: "SUBMITTED" } },
    include: { room: true },
  });
  for (const a of attempts) await reconcileAttempt(a);
}

/** Grades every response and closes the attempt. Idempotent. */
export async function finalizeAttempt(attemptId: string, submittedAt = new Date()): Promise<Attempt> {
  return db.$transaction(async (tx) => {
    const attempt = await tx.attempt.findUniqueOrThrow({
      where: { id: attemptId },
      include: { room: { include: { test: { include: { items: { include: { question: true } } } } } }, responses: true },
    });
    if (attempt.status === "SUBMITTED") return attempt;
    const items = attempt.room.test?.items ?? [];
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

/** Returns the student's attempt, creating it when the room is live. */
export async function getOrStartAttempt(roomId: string, studentId: string, now = new Date()) {
  const room = await db.room.findFirst({
    where: { id: roomId, members: { some: { studentId } } },
  });
  if (!room) return { error: "NOT_FOUND" as const };
  if (!room.testId) return { error: "NO_TEST" as const, room };

  const existing = await db.attempt.findUnique({
    where: { roomId_studentId: { roomId, studentId } },
    include: { room: true },
  });
  if (existing) return { room, attempt: await reconcileAttempt(existing, now) };

  if (now < room.startsAt) return { error: "NOT_STARTED" as const, room };
  if (now >= roomEndsAt(room)) return { error: "CLOSED" as const, room };

  const created = await db.attempt.upsert({
    where: { roomId_studentId: { roomId, studentId } },
    update: {},
    create: { roomId, studentId, module1StartedAt: now },
    include: { room: true },
  });
  return { room, attempt: await reconcileAttempt(created, now) };
}

export function currentDeadline(room: RoomTiming, attempt: Attempt): Date | null {
  if (attempt.status === "MODULE_1") return module1Deadline(room);
  if (attempt.status === "MODULE_2" && attempt.module2StartedAt) return module2Deadline(room, attempt.module2StartedAt);
  return null;
}
