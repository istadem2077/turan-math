import Link from "next/link";
import { db } from "@/lib/db";
import { Card, Empty, Table } from "@/components/ui";
import { ActionButton } from "@/components/client-ui";
import { removeRoomMember } from "../../actions";
import { AddMembers, MoveMember } from "./client";

export default async function RoomStudentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [members, otherRooms, allStudents, quizCount, homeworkCount, attempts, submissions] = await Promise.all([
    db.roomMember.findMany({ where: { roomId: id }, include: { student: true }, orderBy: { student: { fullName: "asc" } } }),
    db.room.findMany({ where: { id: { not: id } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { role: "STUDENT", active: true }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, username: true } }),
    db.quiz.count({ where: { roomId: id, startsAt: { not: null, lte: new Date() } } }),
    db.homework.count({ where: { roomId: id } }),
    db.attempt.groupBy({ by: ["studentId"], where: { quiz: { roomId: id }, status: "SUBMITTED" }, _count: true }),
    db.homeworkSubmission.groupBy({ by: ["studentId"], where: { homework: { roomId: id } }, _count: true }),
  ]);
  const quizzesBy = new Map(attempts.map((a) => [a.studentId, a._count]));
  const hwBy = new Map(submissions.map((s) => [s.studentId, s._count]));
  const memberIds = new Set(members.map((m) => m.studentId));

  return (
    <div className="space-y-6">
      <Card title={`Students (${members.length})`}>
        {members.length === 0 ? (
          <Empty>No students in this room yet. Add some below.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Quizzes taken</th>
                <th>Homework handed in</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(({ student }) => (
                <tr key={student.id}>
                  <td>
                    <Link href={`/staff/students/${student.id}`} className="font-medium text-brand hover:underline">
                      {student.fullName}
                    </Link>
                    <div className="text-xs text-muted">
                      @{student.username}
                      {!student.active && " · deactivated"}
                    </div>
                  </td>
                  <td>
                    {quizzesBy.get(student.id) ?? 0}
                    <span className="text-muted"> / {quizCount}</span>
                  </td>
                  <td>
                    {hwBy.get(student.id) ?? 0}
                    <span className="text-muted"> / {homeworkCount}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <MoveMember roomId={id} studentId={student.id} rooms={otherRooms} />
                      <ActionButton variant="ghost" action={removeRoomMember.bind(null, id, student.id)} confirm={`Remove ${student.fullName} from this room?`}>
                        Remove
                      </ActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Card title="Add students">
        <AddMembers roomId={id} students={allStudents.filter((s) => !memberIds.has(s.id))} />
        <p className="mt-3 text-xs text-muted">
          Need a new account?{" "}
          <Link href="/staff/students" className="text-brand underline">
            Create students
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
