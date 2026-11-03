import "server-only";
import { db } from "./db";
import { currentDeadline } from "./attempts";
import type { Attempt, Room } from "@/generated/prisma/client";
import type { Choice } from "./taxonomy";

export type ExamItem = { id: string; position: number; type: "MCQ" | "SPR"; stem: string; choices: Choice[] | null };
export type ExamResponse = { answer: string | null; marked: boolean; eliminated: string[] };
export type ExamState = {
  roomId: string;
  module: 1 | 2;
  deadline: string;
  serverNow: string;
  items: ExamItem[];
  responses: Record<string, ExamResponse>;
};

/** Builds what the exam client needs for the current module. Never includes answer keys. */
export async function buildExamState(room: Room, attempt: Attempt): Promise<ExamState | null> {
  if (attempt.status === "SUBMITTED" || !room.testId) return null;
  const module = attempt.status === "MODULE_1" ? 1 : 2;
  const [items, responses] = await Promise.all([
    db.testItem.findMany({
      where: { testId: room.testId, module },
      orderBy: { position: "asc" },
      select: { id: true, position: true, question: { select: { type: true, stem: true, choices: true } } },
    }),
    db.response.findMany({ where: { attemptId: attempt.id, testItem: { module } } }),
  ]);
  return {
    roomId: room.id,
    module,
    deadline: currentDeadline(room, attempt)!.toISOString(),
    serverNow: new Date().toISOString(),
    items: items.map((i) => ({
      id: i.id,
      position: i.position,
      type: i.question.type,
      stem: i.question.stem,
      choices: (i.question.choices as Choice[] | null) ?? null,
    })),
    responses: Object.fromEntries(
      responses.map((r) => [r.testItemId, { answer: r.answer, marked: r.markedForReview, eliminated: r.eliminated }]),
    ),
  };
}
