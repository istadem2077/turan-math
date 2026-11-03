"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { errorText } from "@/lib/errors";
import { checkFiles, formFiles, toFileRows } from "@/lib/files";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { currentDeadline, finalizeAttempt, reconcileAttempt } from "@/lib/attempts";
import { isValidSprInput } from "@/lib/grading";
import { GRACE_MS, module1Deadline } from "@/lib/timing";
import { MCQ_KEYS } from "@/lib/taxonomy";

async function loadAttempt(quizId: string) {
  const me = await requireStudent();
  const attempt = await db.attempt.findFirst({
    where: { quizId, studentId: me.id, quiz: { room: { members: { some: { studentId: me.id } } } } },
    include: { quiz: true },
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
  quizId: string,
  testItemId: string,
  patch: { answer?: string | null; marked?: boolean; eliminated?: string[] },
): Promise<SaveResult> {
  const attempt = await loadAttempt(quizId);
  if (!attempt) return { ok: false, reason: "NOT_FOUND" };
  if (attempt.status === "SUBMITTED") return { ok: false, reason: "TIME_UP" };
  const deadline = currentDeadline(attempt.quiz, attempt)!;
  if (Date.now() > deadline.getTime() + GRACE_MS) return { ok: false, reason: "TIME_UP" };

  const parsed = Patch.safeParse(patch);
  if (!parsed.success) return { ok: false, reason: "INVALID" };
  const p = parsed.data;

  const module = attempt.status === "MODULE_1" ? 1 : 2;
  const item = await db.testItem.findFirst({
    where: { id: testItemId, testId: attempt.quiz.testId ?? "", module },
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
export async function submitModule(quizId: string, module: 1 | 2) {
  const attempt = await loadAttempt(quizId);
  if (!attempt) return;
  const now = new Date();
  if (module === 1 && attempt.status === "MODULE_1") {
    // Module 2 never starts later than the fixed module 1 deadline.
    const m1End = module1Deadline(attempt.quiz);
    const at = now < m1End ? now : m1End;
    await db.attempt.updateMany({
      where: { id: attempt.id, status: "MODULE_1" },
      data: { status: "MODULE_2", module1SubmittedAt: at, module2StartedAt: at },
    });
  } else if (module === 2 && attempt.status === "MODULE_2") {
    await finalizeAttempt(attempt.id, now);
  }
}

// ───────────────────────── Homework ─────────────────────────

export type SubmitResult = { ok?: boolean; error?: string; message?: string };

/** Hands in (or replaces) the student's submission for one homework. */
export async function submitHomework(homeworkId: string, _: SubmitResult | undefined, form: FormData): Promise<SubmitResult> {
  const me = await requireStudent();
  try {
    // Only homework in a room this student belongs to.
    const hw = await db.homework.findFirst({
      where: { id: homeworkId, room: { members: { some: { studentId: me.id } } } },
      include: { submissions: { where: { studentId: me.id } } },
    });
    if (!hw) return { error: "Homework not found." };
    const existing = hw.submissions[0];
    if (existing?.gradedAt) return { error: "This submission has been graded and can't be changed." };
    const now = new Date();
    const late = now > hw.dueAt;
    if (late && !hw.allowLate && !existing?.reopened) return { error: "The due date has passed; late submissions aren't accepted." };

    const files = formFiles(form, "files");
    if (files.length === 0) return { error: "Attach at least one file." };
    checkFiles(files, hw.allowedFormats);
    const note = z.string().trim().max(5000).parse(form.get("note") ?? "") || null;

    await db.$transaction(async (tx) => {
      const sub = await tx.homeworkSubmission.upsert({
        where: { homeworkId_studentId: { homeworkId, studentId: me.id } },
        update: { note, submittedAt: now, late, reopened: false },
        create: { homeworkId, studentId: me.id, note, submittedAt: now, late },
      });
      // A new hand-in replaces the previous files.
      await tx.storedFile.deleteMany({ where: { submissionId: sub.id } });
      await tx.storedFile.createMany({ data: await toFileRows(files, { submissionId: sub.id }, me.id) });
    });
    revalidatePath(`/student/rooms/${hw.roomId}/homework/${homeworkId}`);
    return { ok: true, message: late ? "Submitted (late)." : "Submitted." };
  } catch (e) {
    return { error: errorText(e) };
  }
}
