import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge, Card, Field, PageHeader, Table } from "@/components/ui";
import { ActionButton, ResetPasswordButton } from "@/components/client-ui";
import { resetPassword, setUserActive } from "../../actions";
import { EditName, RoomAssignments } from "./client";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const student = await db.user.findUnique({
    where: { id },
    include: { memberships: true, attempts: { include: { room: true }, orderBy: { module1StartedAt: "desc" } } },
  });
  if (!student || student.role !== "STUDENT") notFound();
  const rooms = await db.room.findMany({ orderBy: { startsAt: "desc" }, select: { id: true, name: true, startsAt: true } });

  return (
    <>
      <Link href="/staff/students" className="text-sm font-semibold text-brand hover:underline">
        ← Students
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {student.fullName}
            {!student.active && <Badge tone="bad">Deactivated</Badge>}
          </span>
        }
        subtitle={`@${student.username}`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Rooms">
          <RoomAssignments
            studentId={id}
            assigned={student.memberships.map((m) => m.roomId)}
            rooms={rooms.map((r) => ({ id: r.id, name: r.name, when: r.startsAt.toISOString().slice(0, 10) }))}
          />
        </Card>
        <Card title="Account">
          <div className="space-y-5">
            <Field label="Full name">
              <EditName userId={id} name={student.fullName} />
            </Field>
            <ResetPasswordButton action={resetPassword.bind(null, id)} />
            {student.active ? (
              <ActionButton variant="danger" action={setUserActive.bind(null, id, false)} confirm="Deactivate this student? They will be signed out and unable to sign in.">
                Deactivate account
              </ActionButton>
            ) : (
              <ActionButton action={setUserActive.bind(null, id, true)}>Reactivate account</ActionButton>
            )}
          </div>
        </Card>
      </div>
      <div className="mt-6">
        <Card title="Test history">
          {student.attempts.length === 0 ? (
            <p className="text-sm text-muted">No attempts yet.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Status</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {student.attempts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.room.name}</td>
                    <td>{a.status === "SUBMITTED" ? <Badge tone="ok">Submitted</Badge> : <Badge tone="brand">In progress</Badge>}</td>
                    <td>
                      {a.status === "SUBMITTED" ? (
                        <Link className="font-semibold text-brand hover:underline" href={`/staff/rooms/${a.roomId}/students/${id}`}>
                          {a.rawScore}/44 · ~{a.scaledScore}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
