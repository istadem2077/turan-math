import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Empty, LinkButton, PageHeader, Table } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { PHASE_LABEL, PHASE_TONE, roomPhase } from "@/lib/rooms";

export default async function RoomsPage() {
  const rooms = await db.room.findMany({
    orderBy: { startsAt: "desc" },
    include: { test: { select: { title: true } }, _count: { select: { members: true, attempts: true } } },
  });
  const now = new Date();
  return (
    <>
      <PageHeader
        title="Rooms"
        subtitle="Each room is a scheduled sitting. Students only ever see the rooms they are assigned to."
        actions={<LinkButton href="/staff/rooms/new">New room</LinkButton>}
      />
      {rooms.length === 0 ? (
        <Empty>No rooms yet. Create one to schedule a test.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Room</th>
              <th>Starts</th>
              <th>Test</th>
              <th>Students</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => {
              const phase = roomPhase(r, now);
              return (
                <tr key={r.id} className="hover:bg-canvas">
                  <td>
                    <Link href={`/staff/rooms/${r.id}`} className="font-semibold text-brand hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">
                    <LocalTime iso={r.startsAt.toISOString()} />
                  </td>
                  <td>{r.test?.title ?? <Badge tone="bad">No test</Badge>}</td>
                  <td>
                    {r._count.members}
                    {r._count.attempts > 0 && <span className="text-muted"> · {r._count.attempts} started</span>}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Badge>
                      {r.resultsReleased && <Badge tone="ok">Results released</Badge>}
                      {!r.calculatorAllowed && <Badge>No calculator</Badge>}
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
