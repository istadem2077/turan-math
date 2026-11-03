import "server-only";
import { db } from "@/lib/db";
import { reconcileAttempt } from "@/lib/attempts";
import type { StudentHomework, StudentQuiz } from "./items";

/** Everything a student sees, limited to the rooms they belong to (optionally one room). */
export async function loadStudentRooms(studentId: string, roomId?: string) {
  const rooms = await db.room.findMany({
    where: { members: { some: { studentId } }, ...(roomId && { id: roomId }) },
    orderBy: { name: "asc" },
    include: {
      quizzes: {
        where: { startsAt: { not: null } },
        orderBy: { startsAt: "desc" },
        include: { attempts: { where: { studentId }, include: { quiz: true } } },
      },
      homeworks: { orderBy: { dueAt: "asc" }, include: { submissions: { where: { studentId } } } },
    },
  });
  return Promise.all(
    rooms.map(async (room) => {
      const quizzes: StudentQuiz[] = await Promise.all(
        room.quizzes.map(async ({ attempts, ...q }) => ({
          ...q,
          roomName: room.name,
          attempt: attempts[0] ? await reconcileAttempt(attempts[0]) : null,
        })),
      );
      const homeworks: StudentHomework[] = room.homeworks.map(({ submissions, ...h }) => ({ ...h, roomName: room.name, submission: submissions[0] ?? null }));
      return { id: room.id, name: room.name, quizzes, homeworks };
    }),
  );
}

/** Homework still waiting for this student's hand-in. */
export function needsHandIn(h: StudentHomework, now = new Date()) {
  if (h.submission && !h.submission.reopened) return false;
  return h.dueAt >= now || h.allowLate || !!h.submission?.reopened;
}
