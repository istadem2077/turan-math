"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { errorText } from "@/lib/errors";
import { DEFAULT_MODULE_MINUTES } from "@/lib/blueprint";
import { LOBBY_MINUTES } from "@/lib/timing";
import { FORMAT_PRESETS, parseExtensions } from "@/lib/file-formats";
import { checkFiles, formFiles, toFileRows } from "@/lib/files";
import type { ActionResult } from "../actions";

const roomPath = (roomId: string) => `/staff/rooms/${roomId}`;

// ───────────────────────── Rooms (classrooms) ─────────────────────────

const RoomForm = z.object({
  name: z.string().trim().min(1, "Room name is required").max(120),
  description: z.string().trim().max(2000).optional(),
});

function readRoomForm(form: FormData) {
  const v = RoomForm.parse({ name: form.get("name"), description: form.get("description") ?? undefined });
  return { name: v.name, description: v.description || null };
}

export async function createRoom(_: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  let id: string;
  try {
    id = (await db.room.create({ data: { ...readRoomForm(form), createdById: me.id } })).id;
  } catch (e) {
    return { error: errorText(e) };
  }
  redirect(roomPath(id));
}

export async function updateRoom(roomId: string, _: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  await requireStaff();
  try {
    await db.room.update({ where: { id: roomId }, data: readRoomForm(form) });
    revalidatePath(roomPath(roomId), "layout");
    return { ok: true, message: "Room saved." };
  } catch (e) {
    return { error: errorText(e) };
  }
}

export async function deleteRoom(roomId: string) {
  await requireStaff();
  await db.room.delete({ where: { id: roomId } });
  redirect("/staff/rooms");
}

// ───────────────────────── Quizzes ─────────────────────────

const QuizForm = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  moduleMinutes: z.coerce.number().int().min(1, "Minutes per module must be at least 1").max(180),
  calculatorAllowed: z.boolean(),
  testId: z.string().optional(),
});

function readQuizForm(form: FormData) {
  const v = QuizForm.parse({
    title: form.get("title"),
    moduleMinutes: form.get("moduleMinutes") || DEFAULT_MODULE_MINUTES,
    calculatorAllowed: form.get("calculatorAllowed") === "on",
    testId: String(form.get("testId") ?? "") || undefined,
  });
  return { ...v, testId: v.testId ?? null };
}

function futureDate(value: FormDataEntryValue | null): Date {
  const iso = z.iso.datetime({ message: "Pick a date and time" }).parse(value);
  const d = new Date(iso);
  if (d.getTime() <= Date.now()) throw new Error("The scheduled time must be in the future.");
  return d;
}

export async function createQuiz(roomId: string, _: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  let id: string;
  try {
    const data = readQuizForm(form);
    const schedule = form.get("schedule") === "on";
    const startsAt = schedule ? futureDate(form.get("startsAt")) : null;
    if (startsAt && !data.testId) return { error: "Choose a test before scheduling the quiz." };
    id = (await db.quiz.create({ data: { ...data, roomId, startsAt, createdById: me.id } })).id;
  } catch (e) {
    return { error: errorText(e) };
  }
  redirect(`${roomPath(roomId)}/quizzes/${id}`);
}

async function loadQuiz(quizId: string) {
  return db.quiz.findUniqueOrThrow({ where: { id: quizId }, include: { _count: { select: { attempts: true } } } });
}

function revalidateQuiz(q: { id: string; roomId: string }) {
  revalidatePath(`${roomPath(q.roomId)}/quizzes/${q.id}`);
  revalidatePath(roomPath(q.roomId), "layout");
}

export async function updateQuiz(quizId: string, _: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  await requireStaff();
  try {
    const data = readQuizForm(form);
    const quiz = await loadQuiz(quizId);
    if (quiz._count.attempts > 0 && data.testId !== quiz.testId) return { error: "The test can't be changed after students have started." };
    if (quiz.startsAt && !data.testId) return { error: "A started or scheduled quiz needs a test." };
    await db.quiz.update({ where: { id: quizId }, data });
    revalidateQuiz(quiz);
    return { ok: true, message: "Quiz saved." };
  } catch (e) {
    return { error: errorText(e) };
  }
}

/** Opens the lobby now; module 1 begins for everyone LOBBY_MINUTES later. */
export async function startQuiz(quizId: string) {
  await requireStaff();
  const quiz = await loadQuiz(quizId);
  if (!quiz.testId) throw new Error("Choose a test for this quiz first.");
  const startsAt = new Date(Date.now() + LOBBY_MINUTES * 60_000);
  if (quiz.startsAt && quiz.startsAt <= startsAt) throw new Error("This quiz has already started.");
  await db.quiz.update({ where: { id: quizId }, data: { startsAt } });
  revalidateQuiz(quiz);
}

export async function scheduleQuiz(quizId: string, _: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  await requireStaff();
  try {
    const quiz = await loadQuiz(quizId);
    if (!quiz.testId) return { error: "Choose a test for this quiz first." };
    if (quiz._count.attempts > 0 || (quiz.startsAt && quiz.startsAt <= new Date())) return { error: "This quiz has already started." };
    const startsAt = futureDate(form.get("startsAt"));
    await db.quiz.update({ where: { id: quizId }, data: { startsAt } });
    revalidateQuiz(quiz);
    return { ok: true, message: "Quiz scheduled." };
  } catch (e) {
    return { error: errorText(e) };
  }
}

/** Takes a scheduled quiz (or one whose lobby is open) back to "not started". */
export async function cancelQuizStart(quizId: string) {
  await requireStaff();
  const quiz = await loadQuiz(quizId);
  if (quiz._count.attempts > 0 || (quiz.startsAt && quiz.startsAt <= new Date())) throw new Error("This quiz has already started.");
  await db.quiz.update({ where: { id: quizId }, data: { startsAt: null } });
  revalidateQuiz(quiz);
}

export async function deleteQuiz(quizId: string) {
  await requireStaff();
  const quiz = await db.quiz.delete({ where: { id: quizId } });
  revalidatePath(roomPath(quiz.roomId), "layout");
  redirect(`${roomPath(quiz.roomId)}/quizzes`);
}

export async function setResultsReleased(quizId: string, released: boolean) {
  await requireStaff();
  const quiz = await db.quiz.update({ where: { id: quizId }, data: { resultsReleased: released } });
  revalidateQuiz(quiz);
}

/** Allows a student to retake the quiz (deletes their attempt). */
export async function resetAttempt(quizId: string, studentId: string) {
  await requireStaff();
  await db.attempt.deleteMany({ where: { quizId, studentId } });
  revalidateQuiz(await loadQuiz(quizId));
}

// ───────────────────────── Homework ─────────────────────────

const HomeworkForm = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  instructions: z.string().trim().max(20_000),
  dueAt: z.iso.datetime({ message: "Pick a due date and time" }),
  maxPoints: z.coerce.number().int().min(1, "Points must be at least 1").max(1000),
  allowLate: z.boolean(),
});

function readHomeworkForm(form: FormData) {
  const v = HomeworkForm.parse({
    title: form.get("title"),
    instructions: form.get("instructions") ?? "",
    dueAt: form.get("dueAt"),
    maxPoints: form.get("maxPoints") || 100,
    allowLate: form.get("allowLate") === "on",
  });
  const presets = new Set(form.getAll("formats").map(String));
  const allowedFormats = [
    ...new Set([...FORMAT_PRESETS.filter((p) => presets.has(p.key)).flatMap((p) => p.exts), ...parseExtensions(String(form.get("otherFormats") ?? ""))]),
  ];
  return { ...v, dueAt: new Date(v.dueAt), allowedFormats };
}

export async function createHomework(roomId: string, _: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  let id: string;
  try {
    const data = readHomeworkForm(form);
    const files = formFiles(form, "attachments");
    checkFiles(files);
    id = await db.$transaction(async (tx) => {
      const hw = await tx.homework.create({ data: { ...data, roomId, createdById: me.id } });
      if (files.length) await tx.storedFile.createMany({ data: await toFileRows(files, { homeworkId: hw.id }, me.id) });
      return hw.id;
    });
  } catch (e) {
    return { error: errorText(e) };
  }
  revalidatePath(roomPath(roomId), "layout");
  redirect(`${roomPath(roomId)}/homework/${id}`);
}

export async function updateHomework(homeworkId: string, _: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  try {
    const data = readHomeworkForm(form);
    const files = formFiles(form, "attachments");
    checkFiles(files);
    const hw = await db.homework.update({ where: { id: homeworkId }, data });
    if (files.length) await db.storedFile.createMany({ data: await toFileRows(files, { homeworkId }, me.id) });
    revalidatePath(`${roomPath(hw.roomId)}/homework/${homeworkId}`);
    return { ok: true, message: "Homework saved." };
  } catch (e) {
    return { error: errorText(e) };
  }
}

export async function deleteHomework(homeworkId: string) {
  await requireStaff();
  const hw = await db.homework.delete({ where: { id: homeworkId } });
  revalidatePath(roomPath(hw.roomId), "layout");
  redirect(`${roomPath(hw.roomId)}/homework`);
}

/** Removes a file the professor attached (to an assignment or a response). */
export async function deleteStaffFile(fileId: string) {
  await requireStaff();
  const file = await db.storedFile.findUniqueOrThrow({
    where: { id: fileId },
    include: { homework: true, feedbackSubmission: { include: { homework: true } } },
  });
  // Student-uploaded files are only replaced by the student re-submitting.
  const hw = file.homework ?? file.feedbackSubmission?.homework;
  if (!hw) throw new Error("Only your own attachments can be removed.");
  await db.storedFile.delete({ where: { id: fileId } });
  revalidatePath(`${roomPath(hw.roomId)}/homework/${hw.id}`, "layout");
}

/** Saves the grade and the professor's response. Grading locks the submission. */
export async function gradeSubmission(submissionId: string, _: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  try {
    const sub = await db.homeworkSubmission.findUniqueOrThrow({ where: { id: submissionId }, include: { homework: true } });
    const rawScore = String(form.get("score") ?? "").trim();
    const score = rawScore === "" ? null : z.coerce.number().min(0, "Score can't be negative").max(sub.homework.maxPoints, `Score can be at most ${sub.homework.maxPoints}`).parse(rawScore);
    const feedback = z.string().trim().max(20_000).parse(form.get("feedback") ?? "") || null;
    if (score === null && !feedback) return { error: "Enter a score, a response, or both." };
    const files = formFiles(form, "feedbackFiles");
    checkFiles(files);
    await db.$transaction(async (tx) => {
      await tx.homeworkSubmission.update({
        where: { id: submissionId },
        data: { score, feedback, gradedAt: new Date(), gradedById: me.id },
      });
      if (files.length) await tx.storedFile.createMany({ data: await toFileRows(files, { feedbackSubmissionId: submissionId }, me.id) });
    });
    revalidatePath(`${roomPath(sub.homework.roomId)}/homework/${sub.homeworkId}`, "layout");
    return { ok: true, message: "Saved. The student can now see your grade and response." };
  } catch (e) {
    return { error: errorText(e) };
  }
}

/** Un-grades a submission so the student can hand in again (keeps the response text). */
export async function reopenSubmission(submissionId: string) {
  await requireStaff();
  const sub = await db.homeworkSubmission.update({
    where: { id: submissionId },
    data: { score: null, gradedAt: null, gradedById: null, reopened: true },
    include: { homework: true },
  });
  revalidatePath(`${roomPath(sub.homework.roomId)}/homework/${sub.homeworkId}`, "layout");
}
