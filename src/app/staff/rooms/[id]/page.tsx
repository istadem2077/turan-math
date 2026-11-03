import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { reconcileRoomAttempts } from "@/lib/attempts";
import { Badge, Card, PageHeader, Table, Notice, Empty } from "@/components/ui";
import { ActionButton } from "@/components/client-ui";
import { LocalTime } from "@/components/LocalTime";
import { PHASE_LABEL, PHASE_TONE, roomPhase } from "@/lib/rooms";
import { roomEndsAt } from "@/lib/timing";
import { DOMAIN_SHORT, DIFFICULTY_LABEL } from "@/lib/taxonomy";
import { RoomForm } from "../RoomForm";
import { deleteRoom, removeRoomMember, resetAttempt, setResultsReleased, updateRoom } from "../../actions";
import { AddMembers, AutoRefresh, MoveMember } from "./client";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await reconcileRoomAttempts(id);
  const room = await db.room.findUnique({
    where: { id },
    include: {
      test: { include: { items: { include: { question: { include: { skill: true } } }, orderBy: [{ module: "asc" }, { position: "asc" }] } } },
      members: { include: { student: true }, orderBy: { student: { fullName: "asc" } } },
      attempts: true,
    },
  });
  if (!room) notFound();

  const [tests, otherRooms, allStudents, answeredCounts, itemStats] = await Promise.all([
    db.test.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, title: true, source: true } }),
    db.room.findMany({ where: { id: { not: id } }, orderBy: { startsAt: "desc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { role: "STUDENT", active: true }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, username: true } }),
    db.response.groupBy({ by: ["attemptId"], where: { attempt: { roomId: id }, answer: { not: null } }, _count: true }),
    db.response.groupBy({ by: ["testItemId", "isCorrect"], where: { attempt: { roomId: id, status: "SUBMITTED" } }, _count: true }),
  ]);

  const now = new Date();
  const phase = roomPhase(room, now);
  const attemptBy = new Map(room.attempts.map((a) => [a.studentId, a]));
  const answeredBy = new Map(answeredCounts.map((c) => [c.attemptId, c._count]));
  const memberIds = new Set(room.members.map((m) => m.studentId));
  const submitted = room.attempts.filter((a) => a.status === "SUBMITTED");
  const avg = submitted.length ? Math.round(submitted.reduce((s, a) => s + (a.rawScore ?? 0), 0) / submitted.length * 10) / 10 : null;

  const correctByItem = new Map<string, number>();
  for (const s of itemStats) if (s.isCorrect) correctByItem.set(s.testItemId, s._count);

  return (
    <>
      {phase === "LIVE" && <AutoRefresh seconds={15} />}
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {room.name}
            <Badge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Badge>
          </span>
        }
        subtitle={
          <>
            <LocalTime iso={room.startsAt.toISOString()} /> → <LocalTime iso={roomEndsAt(room).toISOString()} mode="time" /> · 2 × {room.moduleMinutes} min ·{" "}
            {room.calculatorAllowed ? "Desmos allowed" : "No calculator"}
          </>
        }
        actions={
          <>
            {room.resultsReleased ? (
              <ActionButton action={setResultsReleased.bind(null, id, false)}>Hide results from students</ActionButton>
            ) : (
              <ActionButton variant="primary" action={setResultsReleased.bind(null, id, true)} confirm="Students in this room will see their score and a full review. Continue?">
                Release results
              </ActionButton>
            )}
          </>
        }
      />

      <div className="space-y-6">
        {!room.test && <Notice tone="warn">This room has no test yet. Students can't start until you choose one below.</Notice>}

        <Card
          title={`Students (${room.members.length})`}
          actions={
            avg !== null && (
              <span className="text-sm text-muted">
                {submitted.length} submitted · average {avg}/44
              </span>
            )
          }
        >
          {room.members.length === 0 ? (
            <Empty>No students in this room yet. Add some below.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {room.members.map(({ student }) => {
                  const a = attemptBy.get(student.id);
                  let status;
                  if (!a) status = phase === "FINISHED" ? <Badge tone="bad">Absent</Badge> : phase === "LIVE" ? <Badge tone="warn">Not joined</Badge> : <Badge>Waiting</Badge>;
                  else if (a.status === "SUBMITTED") status = <Badge tone="ok">Submitted</Badge>;
                  else status = <Badge tone="brand">{a.status === "MODULE_1" ? "Module 1" : "Module 2"} · {answeredBy.get(a.id) ?? 0} answered</Badge>;
                  return (
                    <tr key={student.id}>
                      <td>
                        <div className="font-medium">{student.fullName}</div>
                        <div className="text-xs text-muted">@{student.username}{!student.active && " · deactivated"}</div>
                      </td>
                      <td>{status}</td>
                      <td>
                        {a?.status === "SUBMITTED" ? (
                          <Link href={`/staff/rooms/${id}/students/${student.id}`} className="font-semibold text-brand hover:underline">
                            {a.rawScore}/44 <span className="font-normal text-muted">· ~{a.scaledScore}</span>
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <MoveMember roomId={id} studentId={student.id} rooms={otherRooms} />
                          {a && (
                            <ActionButton
                              variant="ghost"
                              action={resetAttempt.bind(null, id, student.id)}
                              confirm={`Delete ${student.fullName}'s attempt so they can take this room again? Their answers will be lost.`}
                            >
                              Reset attempt
                            </ActionButton>
                          )}
                          <ActionButton variant="ghost" action={removeRoomMember.bind(null, id, student.id)} confirm={`Remove ${student.fullName} from this room?`}>
                            Remove
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Add students">
            <AddMembers roomId={id} students={allStudents.filter((s) => !memberIds.has(s.id))} />
            <p className="mt-3 text-xs text-muted">
              Need a new account? <Link href="/staff/students" className="text-brand underline">Create students</Link>.
            </p>
          </Card>
          <Card title="Settings">
            <RoomForm
              action={updateRoom.bind(null, id)}
              tests={tests}
              submitLabel="Save settings"
              locked={room.attempts.length > 0}
              initial={{
                name: room.name,
                startsAt: room.startsAt.toISOString(),
                moduleMinutes: room.moduleMinutes,
                calculatorAllowed: room.calculatorAllowed,
                testId: room.testId,
              }}
            />
          </Card>
        </div>

        {room.test && submitted.length > 0 && (
          <Card title="Question analysis" actions={<span className="text-sm text-muted">% of submitted students correct</span>}>
            <Table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Domain</th>
                  <th>Skill</th>
                  <th>Difficulty</th>
                  <th className="text-right">Correct</th>
                </tr>
              </thead>
              <tbody>
                {room.test.items.map((it) => {
                  const pct = Math.round(((correctByItem.get(it.id) ?? 0) / submitted.length) * 100);
                  return (
                    <tr key={it.id}>
                      <td className="whitespace-nowrap font-medium">M{it.module} · {it.position}</td>
                      <td>{DOMAIN_SHORT[it.question.domain]}</td>
                      <td className="text-muted">{it.question.skill.name}</td>
                      <td>{DIFFICULTY_LABEL[it.question.difficulty]}</td>
                      <td className="text-right">
                        <span className={pct < 40 ? "font-semibold text-bad" : pct >= 75 ? "font-semibold text-ok" : ""}>{pct}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        )}

        <div className="flex justify-end">
          <ActionButton variant="danger" action={deleteRoom.bind(null, id)} confirm="Delete this room and all of its attempts? This can't be undone.">
            Delete room
          </ActionButton>
        </div>
      </div>
    </>
  );
}
