"use server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { currentDeadline, finalizeAttempt, reconcileAttempt } from "@/lib/attempts";
import { isValidSprInput } from "@/lib/grading";
import { GRACE_MS, module1Deadline } from "@/lib/timing";
import { MCQ_KEYS } from "@/lib/taxonomy";

async function loadAttempt(roomId: string) {
  const me = await requireStudent();
  const attempt = await db.attempt.findFirst({
    where: { roomId, studentId: me.id, room: { members: { some: { studentId: me.id } } } },
    include: { room: true },
  });
  if (!attempt) return null;
  return { ...attempt, ...(await reconcileAttempt(attempt)) };
}

const Patch = z.object({
  answer: z.string().max(10).nullable().optional(),
  marked: z.boolean().optional(),
  eliminated: z.array(z.enum(MCQ_KEYS)).max(4).optional(),
});

export type SaveResult = { ok: true } | { ok: false; reason: "TIME_UP" | "INVALID" | "NOT_FOUND" };

export async function saveResponse(
  roomId: string,
  testItemId: string,
  patch: { answer?: string | null; marked?: boolean; eliminated?: string[] },
): Promise<SaveResult> {
  const attempt = await loadAttempt(roomId);
  if (!attempt) return { ok: false, reason: "NOT_FOUND" };
  if (attempt.status === "SUBMITTED") return { ok: false, reason: "TIME_UP" };
  const deadline = currentDeadline(attempt.room, attempt)!;
  if (Date.now() > deadline.getTime() + GRACE_MS) return { ok: false, reason: "TIME_UP" };

  const parsed = Patch.safeParse(patch);
  if (!parsed.success) return { ok: false, reason: "INVALID" };
  const p = parsed.data;

  const module = attempt.status === "MODULE_1" ? 1 : 2;
  const item = await db.testItem.findFirst({
    where: { id: testItemId, testId: attempt.room.testId ?? "", module },
    include: { question: { select: { type: true } } },
  });
  if (!item) return { ok: false, reason: "INVALID" };
  if (p.answer != null) {
    if (item.question.type === "MCQ" && !MCQ_KEYS.includes(p.answer as never)) return { ok: false, reason: "INVALID" };
    if (item.question.type === "SPR" && !isValidSprInput(p.answer)) return { ok: false, reason: "INVALID" };
  }
  const data = {
    ...(p.answer !== undefined && { answer: p.answer === "" ? null : p.answer }),
    ...(p.marked !== undefined && { markedForReview: p.marked }),
    ...(p.eliminated !== undefined && { eliminated: p.eliminated }),
  };
  await db.response.upsert({
    where: { attemptId_testItemId: { attemptId: attempt.id, testItemId } },
    update: data,
    create: { attemptId: attempt.id, testItemId, ...data },
  });
  return { ok: true };
}

/** Ends the given module early (or on time-out). Safe to call more than once. */
export async function submitModule(roomId: string, module: 1 | 2) {
  const attempt = await loadAttempt(roomId);
  if (!attempt) return;
  const now = new Date();
  if (module === 1 && attempt.status === "MODULE_1") {
    // Module 2 never starts later than the fixed module 1 deadline.
    const m1End = module1Deadline(attempt.room);
    const at = now < m1End ? now : m1End;
    await db.attempt.updateMany({
      where: { id: attempt.id, status: "MODULE_1" },
      data: { status: "MODULE_2", module1SubmittedAt: at, module2StartedAt: at },
    });
  } else if (module === 2 && attempt.status === "MODULE_2") {
    await finalizeAttempt(attempt.id, now);
  }
}
