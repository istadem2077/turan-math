import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, Notice } from "@/components/ui";
import { AttemptReview } from "@/components/AttemptReview";

export default async function StaffAttemptPage({ params }: { params: Promise<{ id: string; studentId: string }> }) {
  const { id, studentId } = await params;
  const attempt = await db.attempt.findUnique({
    where: { roomId_studentId: { roomId: id, studentId } },
    include: { student: true, room: true },
  });
  if (!attempt) notFound();
  return (
    <>
      <Link href={`/staff/rooms/${id}`} className="text-sm font-semibold text-brand hover:underline">
        ← {attempt.room.name}
      </Link>
      <PageHeader title={attempt.student.fullName} subtitle={`@${attempt.student.username} · ${attempt.room.name}`} />
      {attempt.status === "SUBMITTED" ? <AttemptReview attemptId={attempt.id} /> : <Notice>This attempt is still in progress.</Notice>}
    </>
  );
}
