import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, Notice } from "@/components/ui";
import { AttemptReview } from "@/components/AttemptReview";

export default async function StaffAttemptPage({ params }: { params: Promise<{ id: string; quizId: string; studentId: string }> }) {
  const { id, quizId, studentId } = await params;
  const attempt = await db.attempt.findUnique({
    where: { quizId_studentId: { quizId, studentId } },
    include: { student: true, quiz: true },
  });
  if (!attempt || attempt.quiz.roomId !== id) notFound();
  return (
    <>
      <Link href={`/staff/rooms/${id}/quizzes/${quizId}`} className="text-sm font-semibold text-brand hover:underline">
        ← {attempt.quiz.title}
      </Link>
      <PageHeader title={attempt.student.fullName} subtitle={`@${attempt.student.username} · ${attempt.quiz.title}`} />
      {attempt.status === "SUBMITTED" ? <AttemptReview attemptId={attempt.id} /> : <Notice>This attempt is still in progress.</Notice>}
    </>
  );
}
