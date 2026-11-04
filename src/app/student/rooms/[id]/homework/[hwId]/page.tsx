import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { Card, Notice } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { MathText } from "@/components/MathText";
import { FileList } from "@/components/FileList";
import { FILE_META } from "@/lib/files";
import { formatsLabel } from "@/lib/file-formats";
import { StudentShell } from "../../../../Shell";
import { homeworkStatus } from "../../../../items";
import { SubmitForm } from "./SubmitForm";

export default async function StudentHomeworkPage({ params }: { params: Promise<{ id: string; hwId: string }> }) {
  const me = await requireStudent();
  const { id, hwId } = await params;
  // Only homework in a room this student belongs to; only their own submission.
  const hw = await db.homework.findFirst({
    where: { id: hwId, roomId: id, room: { members: { some: { studentId: me.id } } } },
    include: {
      room: { select: { name: true } },
      attachments: { select: FILE_META, orderBy: { createdAt: "asc" } },
      submissions: {
        where: { studentId: me.id },
        include: {
          files: { select: FILE_META, orderBy: { filename: "asc" } },
          feedbackFiles: { select: FILE_META, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!hw) notFound();
  const sub = hw.submissions[0] ?? null;
  const now = new Date();
  const pastDue = now > hw.dueAt;
  const canSubmit = !sub?.gradedAt && (!pastDue || hw.allowLate || !!sub?.reopened);

  return (
    <StudentShell name={me.fullName}>
      <section>
        <Link href={`/student/rooms/${id}`} className="text-sm font-semibold text-brand hover:underline">
          ← {hw.room.name}
        </Link>
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold">
          {hw.title} {homeworkStatus({ ...hw, submission: sub })}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Due <LocalTime iso={hw.dueAt.toISOString()} /> · {hw.maxPoints} points · hand in: {formatsLabel(hw.allowedFormats)}
          {pastDue && hw.allowLate && " · late hand-ins accepted"}
        </p>
      </section>

      {(hw.instructions || hw.attachments.length > 0) && (
        <Card title="Assignment">
          <div className="space-y-4">
            {hw.instructions && <MathText>{hw.instructions}</MathText>}
            <FileList files={hw.attachments} />
          </div>
        </Card>
      )}

      {sub?.gradedAt && (
        <Card title="Your professor's response">
          <div className="space-y-4">
            {sub.score != null && (
              <div className="text-3xl font-bold text-brand">
                {sub.score}
                <span className="text-lg font-semibold text-muted"> / {hw.maxPoints}</span>
              </div>
            )}
            {sub.feedback && <MathText>{sub.feedback}</MathText>}
            <FileList files={sub.feedbackFiles} />
          </div>
        </Card>
      )}

      {sub && (
        <Card title="Your hand-in">
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Handed in <LocalTime iso={sub.submittedAt.toISOString()} />
              {sub.late && <span className="font-semibold text-bad"> · late</span>}
            </p>
            <FileList files={sub.files} />
            {sub.note && <p className="text-sm whitespace-pre-line">{sub.note}</p>}
            {sub.reopened && <Notice tone="warn">Your professor reopened this homework. Hand it in again below.</Notice>}
          </div>
        </Card>
      )}

      {canSubmit ? (
        <Card title={sub ? "Replace your hand-in" : "Hand in"}>
          {pastDue && <div className="mb-4"><Notice tone="warn">The due date has passed. Your hand-in will be marked late.</Notice></div>}
          <SubmitForm homeworkId={hw.id} formats={hw.allowedFormats} resubmit={!!sub} />
        </Card>
      ) : (
        !sub && <Notice tone="bad">The due date has passed and this homework no longer accepts hand-ins.</Notice>
      )}
    </StudentShell>
  );
}
