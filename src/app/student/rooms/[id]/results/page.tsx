import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { AttemptReview } from "@/components/AttemptReview";

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStudent();
  const { id } = await params;
  const attempt = await db.attempt.findFirst({
    where: { roomId: id, studentId: me.id, status: "SUBMITTED", room: { resultsReleased: true, members: { some: { studentId: me.id } } } },
    include: { room: true },
  });
  if (!attempt) notFound();
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/student" className="text-sm font-semibold text-brand hover:underline">
        ← My tests
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">{attempt.room.name} — results</h1>
      <AttemptReview attemptId={attempt.id} />
    </main>
  );
}
