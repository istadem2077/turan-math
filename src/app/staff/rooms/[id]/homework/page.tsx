import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Empty, LinkButton, Table } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { formatsLabel } from "@/lib/file-formats";

export default async function RoomHomeworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [homeworks, memberCount] = await Promise.all([
    db.homework.findMany({
      where: { roomId: id },
      orderBy: { dueAt: "desc" },
      include: { submissions: { select: { gradedAt: true } } },
    }),
    db.roomMember.count({ where: { roomId: id } }),
  ]);
  const now = new Date();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Homework is only visible to students in this room.</p>
        <LinkButton href={`/staff/rooms/${id}/homework/new`}>New homework</LinkButton>
      </div>
      {homeworks.length === 0 ? (
        <Empty>No homework assigned in this room yet.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Homework</th>
              <th>Due</th>
              <th>Handed in</th>
              <th>To grade</th>
            </tr>
          </thead>
          <tbody>
            {homeworks.map((h) => {
              const toGrade = h.submissions.filter((s) => !s.gradedAt).length;
              return (
                <tr key={h.id} className="hover:bg-canvas">
                  <td>
                    <Link href={`/staff/rooms/${id}/homework/${h.id}`} className="font-semibold text-brand hover:underline">
                      {h.title}
                    </Link>
                    <div className="text-xs text-muted">
                      {h.maxPoints} pts · {formatsLabel(h.allowedFormats)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    <LocalTime iso={h.dueAt.toISOString()} />
                    {h.dueAt < now && (
                      <span className="ml-2">
                        <Badge>Closed{h.allowLate && " · late OK"}</Badge>
                      </span>
                    )}
                  </td>
                  <td>
                    {h.submissions.length}
                    <span className="text-muted"> / {memberCount}</span>
                  </td>
                  <td>{toGrade ? <Badge tone="warn">{toGrade} to grade</Badge> : <span className="text-muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
