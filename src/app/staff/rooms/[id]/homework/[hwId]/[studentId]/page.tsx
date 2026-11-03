import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge, Card, Notice } from "@/components/ui";
import { ActionButton } from "@/components/client-ui";
import { LocalTime } from "@/components/LocalTime";
import { FileList } from "@/components/FileList";
import { FILE_META } from "@/lib/files";
import { GradeForm } from "../../GradeForm";
import { deleteStaffFile, gradeSubmission, reopenSubmission } from "../../../../actions";

export default async function GradeSubmissionPage({ params }: { params: Promise<{ id: string; hwId: string; studentId: string }> }) {
  const { id, hwId, studentId } = await params;
  const sub = await db.homeworkSubmission.findUnique({
    where: { homeworkId_studentId: { homeworkId: hwId, studentId } },
    include: {
      homework: true,
      student: true,
      gradedBy: { select: { fullName: true } },
      files: { select: FILE_META, orderBy: { filename: "asc" } },
      feedbackFiles: { select: FILE_META, orderBy: { createdAt: "asc" } },
    },
  });
  if (!sub || sub.homework.roomId !== id) notFound();

  // Next submission still waiting for a grade (alphabetical), for quick grading.
  const next = await db.homeworkSubmission.findFirst({
    where: { homeworkId: hwId, gradedAt: null, studentId: { not: studentId } },
    orderBy: { student: { fullName: "asc" } },
    select: { studentId: true, student: { select: { fullName: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href={`/staff/rooms/${id}/homework/${hwId}`} className="text-sm font-semibold text-brand hover:underline">
            ← {sub.homework.title}
          </Link>
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold">
            {sub.student.fullName}
            {sub.gradedAt ? <Badge tone="ok">Graded</Badge> : <Badge tone="warn">To grade</Badge>}
            {sub.late && <Badge tone="bad">Late</Badge>}
          </h2>
          <p className="mt-1 text-sm text-muted">
            @{sub.student.username} · handed in <LocalTime iso={sub.submittedAt.toISOString()} /> · due{" "}
            <LocalTime iso={sub.homework.dueAt.toISOString()} />
          </p>
        </div>
        {next && (
          <Link href={`/staff/rooms/${id}/homework/${hwId}/${next.studentId}`} className="text-sm font-semibold text-brand hover:underline">
            Next to grade: {next.student.fullName} →
          </Link>
        )}
      </div>

      <Card title="Submission">
        <div className="space-y-4">
          <FileList files={sub.files} />
          {sub.note && (
            <div>
              <div className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Student&apos;s note</div>
              <p className="text-sm whitespace-pre-line">{sub.note}</p>
            </div>
          )}
        </div>
      </Card>

      <Card title="Grade & response">
        <div className="space-y-5">
          {sub.gradedAt && (
            <Notice tone="ok">
              Graded <LocalTime iso={sub.gradedAt.toISOString()} />
              {sub.gradedBy && <> by {sub.gradedBy.fullName}</>}. The student can see the grade and response, and can&apos;t change the submission.
            </Notice>
          )}
          {sub.feedbackFiles.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Files in your response</div>
              <FileList files={sub.feedbackFiles} onDelete={(fid) => deleteStaffFile.bind(null, fid)} />
            </div>
          )}
          <GradeForm
            action={gradeSubmission.bind(null, sub.id)}
            maxPoints={sub.homework.maxPoints}
            initial={{ score: sub.score, feedback: sub.feedback ?? "", graded: !!sub.gradedAt }}
          />
          {sub.gradedAt && (
            <div className="border-t border-line pt-4">
              <ActionButton
                action={reopenSubmission.bind(null, sub.id)}
                confirm="Remove the score and let the student hand in again (even after the due date)? Your response text is kept."
              >
                Reopen for resubmission
              </ActionButton>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
