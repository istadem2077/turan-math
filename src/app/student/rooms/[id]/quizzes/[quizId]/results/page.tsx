import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { AttemptReview } from "@/components/AttemptReview";

export default async function ResultsPage({ params }: { params: Promise<{ id: string; quizId: string }> }) {
  const me = await requireStudent();
  const { id, quizId } = await params;
  const attempt = await db.attempt.findFirst({
    where: {
      quizId,
      studentId: me.id,
      status: "SUBMITTED",
      quiz: { roomId: id, resultsReleased: true, room: { members: { some: { studentId: me.id } } } },
    },
    include: { quiz: { include: { room: { select: { name: true } } } } },
  });
  if (!attempt) notFound();
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href={`/student/rooms/${id}`} className="text-sm font-semibold text-brand hover:underline">
        ← {attempt.quiz.room.name}
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">{attempt.quiz.title} — results</h1>
      <AttemptReview attemptId={attempt.id} />
    </main>
  );
}
