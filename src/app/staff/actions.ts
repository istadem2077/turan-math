"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { generatePassword, hashPassword, requireAdmin, requireStaff } from "@/lib/auth";
import { createTest, generateAutoTest } from "@/lib/tests";
import { parseImportFile, toQuestionData } from "@/lib/question-import";
import { MCQ_KEYS } from "@/lib/taxonomy";
import { Prisma } from "@/generated/prisma/client";
import { errorText } from "@/lib/errors";
import { questionWhere, type QuestionFilters } from "@/lib/question-filters";

export type ActionResult = { ok?: boolean; error?: string; message?: string; password?: string; username?: string };

const USERNAME = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "Username: 3–32 characters, letters, digits, . _ -");

// ───────────────────────── Users ─────────────────────────

async function createUser(role: "STUDENT" | "PROFESSOR", form: FormData, createdById: string): Promise<ActionResult> {
  try {
    const username = USERNAME.parse(form.get("username"));
    const fullName = z.string().trim().min(1, "Full name is required").max(100).parse(form.get("fullName"));
    const typed = String(form.get("password") ?? "").trim();
    const password = typed || generatePassword();
    if (password.length < 6) return { error: "Password must be at least 6 characters." };
    await db.user.create({
      data: { username, fullName, role, passwordHash: await hashPassword(password), createdById },
    });
    revalidatePath("/staff/students");
    revalidatePath("/staff/professors");
    return { ok: true, username, password };
  } catch (e) {
    return { error: errorText(e) };
  }
}

export async function createStudent(_: ActionResult | undefined, form: FormData) {
  const me = await requireStaff();
  const res = await createUser("STUDENT", form, me.id);
  const roomId = String(form.get("roomId") ?? "");
  if (res.ok && roomId) {
    const student = await db.user.findUniqueOrThrow({ where: { username: res.username } });
    await db.roomMember.create({ data: { roomId, studentId: student.id } });
    revalidatePath(`/staff/rooms/${roomId}`, "layout");
  }
  return res;
}

export async function createProfessor(_: ActionResult | undefined, form: FormData) {
  const me = await requireAdmin();
  return createUser("PROFESSOR", form, me.id);
}

async function assertCanManage(userId: string) {
  const me = await requireStaff();
  const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (target.role === "ADMIN" || (target.role === "PROFESSOR" && me.role !== "ADMIN")) {
    throw new Error("Not allowed.");
  }
  return target;
}

export async function resetPassword(userId: string): Promise<ActionResult> {
  const target = await assertCanManage(userId);
  const password = generatePassword();
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } });
  return { ok: true, username: target.username, password };
}

export async function setUserActive(userId: string, active: boolean) {
  await assertCanManage(userId);
  await db.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/staff/students");
  revalidatePath("/staff/professors");
}

export async function updateStudentName(userId: string, fullName: string) {
  await assertCanManage(userId);
  await db.user.update({ where: { id: userId }, data: { fullName: z.string().trim().min(1).max(100).parse(fullName) } });
  revalidatePath(`/staff/students/${userId}`);
}

// ───────────────────────── Room membership ─────────────────────────
// Rooms, quizzes and homework: see ./rooms/actions.ts

export async function addRoomMembers(roomId: string, studentIds: string[]) {
  await requireStaff();
  const students = await db.user.findMany({ where: { id: { in: studentIds }, role: "STUDENT" }, select: { id: true } });
  await db.roomMember.createMany({ data: students.map((s) => ({ roomId, studentId: s.id })), skipDuplicates: true });
  revalidatePath(`/staff/rooms/${roomId}`, "layout");
}

export async function removeRoomMember(roomId: string, studentId: string) {
  await requireStaff();
  await db.roomMember.delete({ where: { roomId_studentId: { roomId, studentId } } });
  revalidatePath(`/staff/rooms/${roomId}`, "layout");
}

/** Moves a student from one room to another (keeps any attempt in the old room). */
export async function moveRoomMember(fromRoomId: string, toRoomId: string, studentId: string) {
  await requireStaff();
  await db.$transaction([
    db.roomMember.delete({ where: { roomId_studentId: { roomId: fromRoomId, studentId } } }),
    db.roomMember.upsert({
      where: { roomId_studentId: { roomId: toRoomId, studentId } },
      update: {},
      create: { roomId: toRoomId, studentId },
    }),
  ]);
  revalidatePath(`/staff/rooms/${fromRoomId}`, "layout");
  revalidatePath(`/staff/rooms/${toRoomId}`, "layout");
}

export async function setStudentRooms(studentId: string, roomIds: string[]) {
  await requireStaff();
  await db.$transaction([
    db.roomMember.deleteMany({ where: { studentId, roomId: { notIn: roomIds } } }),
    db.roomMember.createMany({ data: roomIds.map((roomId) => ({ roomId, studentId })), skipDuplicates: true }),
  ]);
  revalidatePath(`/staff/students/${studentId}`);
}

// ───────────────────────── Tests ─────────────────────────

export async function generateTest(_: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const me = await requireStaff();
  let id: string;
  try {
    const title = z.string().trim().min(1, "Title is required").max(120).parse(form.get("title"));
    id = (await generateAutoTest(title, me.id)).id;
  } catch (e) {
    return { error: errorText(e) };
  }
  redirect(`/staff/tests/${id}`);
}

export async function saveManualTest(title: string, modules: string[][]): Promise<ActionResult> {
  const me = await requireStaff();
  let id: string;
  try {
    const t = z.string().trim().min(1, "Title is required").max(120).parse(title);
    id = (await createTest(t, "MANUAL", me.id, modules)).id;
  } catch (e) {
    return { error: errorText(e) };
  }
  redirect(`/staff/tests/${id}`);
}

export async function deleteTest(testId: string) {
  await requireStaff();
  const used = await db.quiz.count({ where: { testId } });
  if (used) return { error: "This test is assigned to a quiz, so it can't be deleted." };
  await db.test.delete({ where: { id: testId } });
  redirect("/staff/tests");
}

const SearchInput = z.object({
  domain: z.string().optional(),
  skillId: z.coerce.number().optional(),
  difficulty: z.string().optional(),
  type: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  exclude: z.array(z.string()).default([]),
});

/** Question search used by the manual test builder. */
export async function searchQuestions(input: z.input<typeof SearchInput>) {
  await requireStaff();
  const f = SearchInput.parse(input);
  const where: Prisma.QuestionWhereInput = {
    active: true,
    ...(f.domain && { domain: f.domain as never }),
    ...(f.skillId && { skillId: f.skillId }),
    ...(f.difficulty && { difficulty: f.difficulty as never }),
    ...(f.type && { type: f.type as never }),
    ...(f.q && { stem: { contains: f.q, mode: "insensitive" } }),
    ...(f.exclude.length && { id: { notIn: f.exclude } }),
  };
  const PAGE = 20;
  const [total, rows] = await Promise.all([
    db.question.count({ where }),
    db.question.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * PAGE,
      take: PAGE,
      include: { skill: true },
    }),
  ]);
  return {
    total,
    pages: Math.max(1, Math.ceil(total / PAGE)),
    rows: rows.map((q) => ({
      id: q.id,
      domain: q.domain,
      skill: q.skill.name,
      difficulty: q.difficulty,
      type: q.type,
      stem: q.stem,
      choices: q.choices as { key: string; text: string }[] | null,
      correctChoice: q.correctChoice,
      sprAnswers: q.sprAnswers,
    })),
  };
}

// ───────────────────────── Question bank (admin) ─────────────────────────

const QuestionForm = z
  .object({
    skillId: z.coerce.number().int(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    type: z.enum(["MCQ", "SPR"]),
    stem: z.string().trim().min(1, "Question text is required"),
    choiceA: z.string().trim().optional(),
    choiceB: z.string().trim().optional(),
    choiceC: z.string().trim().optional(),
    choiceD: z.string().trim().optional(),
    correctChoice: z.string().optional(),
    sprAnswers: z.string().optional(),
    explanation: z.string().trim().optional(),
    externalId: z.string().trim().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "MCQ") {
      if (!v.choiceA || !v.choiceB || !v.choiceC || !v.choiceD) ctx.addIssue({ code: "custom", message: "All four choices are required" });
      if (!MCQ_KEYS.includes(v.correctChoice as never)) ctx.addIssue({ code: "custom", message: "Pick the correct choice" });
    } else if (!v.sprAnswers?.split("|").some((s) => s.trim())) {
      ctx.addIssue({ code: "custom", message: "Enter at least one accepted answer" });
    }
  });

export async function saveQuestion(id: string | null, _: ActionResult | undefined, form: FormData): Promise<ActionResult> {
  const me = await requireAdmin();
  let savedId: string;
  try {
    const v = QuestionForm.parse(Object.fromEntries(form));
    const skill = await db.skill.findUniqueOrThrow({ where: { id: v.skillId } });
    const data = {
      domain: skill.domain,
      skillId: skill.id,
      difficulty: v.difficulty,
      type: v.type,
      stem: v.stem,
      explanation: v.explanation || null,
      externalId: v.externalId || null,
      choices:
        v.type === "MCQ"
          ? [
              { key: "A", text: v.choiceA! },
              { key: "B", text: v.choiceB! },
              { key: "C", text: v.choiceC! },
              { key: "D", text: v.choiceD! },
            ]
          : Prisma.DbNull,
      correctChoice: v.type === "MCQ" ? v.correctChoice! : null,
      sprAnswers: v.type === "SPR" ? v.sprAnswers!.split("|").map((s) => s.trim()).filter(Boolean) : [],
    };
    if (id) {
      // Questions already used in a submitted attempt are graded against their
      // stored answer key; editing the key would change past results.
      savedId = (await db.question.update({ where: { id }, data })).id;
    } else {
      savedId = (await db.question.create({ data: { ...data, createdById: me.id } })).id;
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "That external ID is already used." };
    return { error: errorText(e) };
  }
  revalidatePath("/staff/questions");
  redirect(`/staff/questions/${savedId}`);
}

export async function setQuestionActive(id: string, active: boolean) {
  await requireAdmin();
  await db.question.update({ where: { id }, data: { active } });
  revalidatePath(`/staff/questions/${id}`);
  revalidatePath("/staff/questions");
}

export async function importQuestions(_: unknown, form: FormData) {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a .json or .csv file." };
  try {
    const rows = parseImportFile(file.name, await file.text());
    const skills = await db.skill.findMany();
    const { ok, errors } = toQuestionData(rows, skills);
    let inserted = 0;
    for (let i = 0; i < ok.length; i += 1000) {
      inserted += (await db.question.createMany({ data: ok.slice(i, i + 1000), skipDuplicates: true })).count;
    }
    revalidatePath("/staff/questions");
    return { total: rows.length, valid: ok.length, inserted, duplicates: ok.length - inserted, errors: errors.slice(0, 200), errorCount: errors.length };
  } catch (e) {
    return { error: errorText(e) };
  }
}

export async function uploadAsset(form: FormData): Promise<{ url?: string; error?: string }> {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return { error: "Choose an image file." };
  if (file.size > 5 * 1024 * 1024) return { error: "Images must be under 5 MB." };
  const asset = await db.asset.create({
    data: { mimeType: file.type, filename: file.name, data: new Uint8Array(await file.arrayBuffer()) },
  });
  return { url: `/api/assets/${asset.id}` };
}

// ───────────────────────── Reviewing questions in bulk ─────────────────────────

export type BulkTarget = { ids: string[] } | { filters: QuestionFilters };

/** Activate, deactivate or delete many questions: the selected ones, or all that match a filter. */
export async function bulkQuestions(target: BulkTarget, op: "activate" | "deactivate" | "delete"): Promise<ActionResult> {
  await requireAdmin();
  const where: Prisma.QuestionWhereInput = "ids" in target ? { id: { in: target.ids } } : questionWhere(target.filters);
  let message: string;
  if (op === "delete") {
    // Questions used in a test stay: past attempts and reviews point at them.
    const total = await db.question.count({ where });
    const { count } = await db.question.deleteMany({ where: { AND: [where, { testItems: { none: {} } }] } });
    message = `Deleted ${count} question${count === 1 ? "" : "s"}.` + (total > count ? ` ${total - count} used in tests ${total - count === 1 ? "was" : "were"} kept (deactivate them instead).` : "");
  } else {
    const { count } = await db.question.updateMany({ where, data: { active: op === "activate" } });
    message = `${op === "activate" ? "Activated" : "Deactivated"} ${count} question${count === 1 ? "" : "s"}.`;
  }
  revalidatePath("/staff/questions");
  return { ok: true, message };
}

/** One step of review mode: optionally fix skill/difficulty, then activate, keep (skip) or delete. */
export async function reviewQuestion(
  id: string,
  decision: "activate" | "skip" | "delete",
  edits: { skillId: number; difficulty: "EASY" | "MEDIUM" | "HARD" },
): Promise<ActionResult> {
  await requireAdmin();
  if (decision === "delete") {
    const used = await db.testItem.count({ where: { questionId: id } });
    if (used) return { error: "This question is used in a test, so it can't be deleted." };
    await db.question.delete({ where: { id } });
    return { ok: true };
  }
  const skill = await db.skill.findUniqueOrThrow({ where: { id: edits.skillId } });
  await db.question.update({
    where: { id },
    data: { skillId: skill.id, domain: skill.domain, difficulty: edits.difficulty, ...(decision === "activate" && { active: true }) },
  });
  return { ok: true };
}
