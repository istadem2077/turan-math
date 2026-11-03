import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge, Card, Empty, Table } from "@/components/ui";
import { ActionButton } from "@/components/client-ui";
import { LocalTime } from "@/components/LocalTime";
import { MathText } from "@/components/MathText";
import { FileList } from "@/components/FileList";
import { FILE_META } from "@/lib/files";
import { formatsLabel } from "@/lib/file-formats";
import { HomeworkForm } from "../HomeworkForm";
import { deleteHomework, deleteStaffFile, updateHomework } from "../../../actions";

export default async function HomeworkPage({ params }: { params: Promise<{ id: string; hwId: string }> }) {
  const { id, hwId } = await params;
  const hw = await db.homework.findFirst({
    where: { id: hwId, roomId: id },
    include: {
      attachments: { select: FILE_META, orderBy: { createdAt: "asc" } },
      submissions: { include: { student: true, _count: { select: { files: true } } } },
    },
  });
  if (!hw) notFound();
  const members = await db.roomMember.findMany({ where: { roomId: id }, include: { student: true }, orderBy: { student: { fullName: "asc" } } });
  const subBy = new Map(hw.submissions.map((s) => [s.studentId, s]));
  const memberIds = new Set(members.map((m) => m.studentId));
  const students = [...members.map((m) => m.student), ...hw.submissions.filter((s) => !memberIds.has(s.studentId)).map((s) => s.student)];
  const graded = hw.submissions.filter((s) => s.gradedAt && s.score !== null);
  const avg = graded.length ? Math.round((graded.reduce((t, s) => t + (s.score ?? 0), 0) / graded.length) * 10) / 10 : null;
  const now = new Date();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/staff/rooms/${id}/homework`} className="text-sm font-semibold text-brand hover:underline">
          ← Homework
        </Link>
        <h2 className="text-xl font-bold">{hw.title}</h2>
        <p className="mt-1 text-sm text-muted">
          Due <LocalTime iso={hw.dueAt.toISOString()} /> · {hw.maxPoints} pts · {formatsLabel(hw.allowedFormats)} ·{" "}
          {hw.allowLate ? "late submissions accepted" : "no late submissions"}
          {hw.dueAt < now && " · closed"}
        </p>
      </div>

      {(hw.instructions || hw.attachments.length > 0) && (
        <Card title="Assignment">
          <div className="space-y-4">
            {hw.instructions && <MathText>{hw.instructions}</MathText>}
            <FileList files={hw.attachments} onDelete={(fid) => deleteStaffFile.bind(null, fid)} />
          </div>
        </Card>
      )}

      <Card
        title={`Submissions (${hw.submissions.length}/${members.length})`}
        actions={avg !== null && <span className="text-sm text-muted">average {avg}/{hw.maxPoints}</span>}
      >
        {students.length === 0 ? (
          <Empty>No students in this room yet.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Handed in</th>
                <th>Score</th>
                <th className="text-right"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((st) => {
                const s = subBy.get(st.id);
                return (
                  <tr key={st.id}>
                    <td>
                      <div className="font-medium">{st.fullName}</div>
                      <div className="text-xs text-muted">
                        @{st.username}
                        {!memberIds.has(st.id) && " · no longer in this room"}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {!s ? (
                          hw.dueAt < now ? <Badge tone="bad">Missing</Badge> : <Badge>Not handed in</Badge>
                        ) : s.gradedAt ? (
                          <Badge tone="ok">Graded</Badge>
                        ) : (
                          <Badge tone="warn">To grade</Badge>
                        )}
                        {s?.late && <Badge tone="bad">Late</Badge>}
                        {s?.reopened && !s.gradedAt && <Badge tone="brand">Reopened</Badge>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      {s ? (
                        <>
                          <LocalTime iso={s.submittedAt.toISOString()} />
                          <div className="text-xs text-muted">{s._count.files} file(s)</div>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>{s?.score != null ? <b>{s.score}/{hw.maxPoints}</b> : <span className="text-muted">—</span>}</td>
                    <td className="text-right">
                      {s && (
                        <Link href={`/staff/rooms/${id}/homework/${hwId}/${st.id}`} className="font-semibold text-brand hover:underline">
                          {s.gradedAt ? "View / edit" : "Grade"} →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="Edit homework">
        <HomeworkForm
          action={updateHomework.bind(null, hwId)}
          submitLabel="Save changes"
          initial={{
            title: hw.title,
            instructions: hw.instructions,
            dueAt: hw.dueAt.toISOString(),
            maxPoints: hw.maxPoints,
            allowLate: hw.allowLate,
            allowedFormats: hw.allowedFormats,
          }}
        />
      </Card>

      <div className="flex justify-end">
        <ActionButton variant="danger" action={deleteHomework.bind(null, hwId)} confirm="Delete this homework with every submission and file? This can't be undone.">
          Delete homework
        </ActionButton>
      </div>
    </div>
  );
}
