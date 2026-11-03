import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Empty, LinkButton, PageHeader, Table } from "@/components/ui";
import { PHASE_LABEL, PHASE_TONE, quizPhase } from "@/lib/rooms";

export default async function RoomsPage() {
  const now = new Date();
  const rooms = await db.room.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { members: true, quizzes: true } },
      quizzes: { where: { startsAt: { not: null, gte: new Date(now.getTime() - 6 * 3600_000) } }, orderBy: { startsAt: "asc" } },
      homeworks: { where: { dueAt: { gte: now } }, select: { id: true } },
    },
  });
  return (
    <>
      <PageHeader
        title="Rooms"
        subtitle="Rooms are classrooms. Students only ever see the rooms they belong to, and the quizzes and homework in them."
        actions={<LinkButton href="/staff/rooms/new">New room</LinkButton>}
      />
      {rooms.length === 0 ? (
        <Empty>No rooms yet. Create one for each class or group of students.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Room</th>
              <th>Students</th>
              <th>Quizzes</th>
              <th>Open homework</th>
              <th>Now</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => {
              const active = r.quizzes.map((q) => ({ q, phase: quizPhase(q, now) })).filter((x) => x.phase !== "FINISHED");
              return (
                <tr key={r.id} className="hover:bg-canvas">
                  <td>
                    <Link href={`/staff/rooms/${r.id}`} className="font-semibold text-brand hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td>{r._count.members}</td>
                  <td>{r._count.quizzes}</td>
                  <td>{r.homeworks.length}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {active.length === 0 && <span className="text-muted">—</span>}
                      {active.map(({ q, phase }) => (
                        <Link key={q.id} href={`/staff/rooms/${r.id}/quizzes/${q.id}`}>
                          <Badge tone={PHASE_TONE[phase]}>
                            {q.title}: {PHASE_LABEL[phase]}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
