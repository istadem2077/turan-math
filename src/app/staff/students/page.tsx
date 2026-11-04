import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Card, Empty, Input, PageHeader, Table } from "@/components/ui";
import { CreateUserForm } from "@/components/client-ui";
import { createStudent } from "../actions";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [students, rooms] = await Promise.all([
    db.user.findMany({
      where: {
        role: "STUDENT",
        ...(q && { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { username: { contains: q.toLowerCase() } }] }),
      },
      orderBy: [{ active: "desc" }, { fullName: "asc" }],
      include: { memberships: { include: { room: { select: { id: true, name: true } } } } },
    }),
    db.room.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Students" subtitle="Students sign in with the username and password you give them." />
      <div className="space-y-6">
        <Card title="Create a student">
          <CreateUserForm action={createStudent} noun="student" rooms={rooms} />
        </Card>
        <form className="max-w-sm">
          <Input name="q" defaultValue={q} placeholder="Search by name or username…" />
        </form>
        {students.length === 0 ? (
          <Empty>{q ? "No students match." : "No students yet."}</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Rooms</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className={s.active ? "" : "opacity-60"}>
                  <td>
                    <Link href={`/staff/students/${s.id}`} className="font-semibold text-brand hover:underline">
                      {s.fullName}
                    </Link>
                    {!s.active && <span className="ml-2"><Badge tone="bad">Deactivated</Badge></span>}
                  </td>
                  <td className="text-muted">@{s.username}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {s.memberships.length === 0 && <span className="text-muted">—</span>}
                      {s.memberships.map((m) => (
                        <Link key={m.roomId} href={`/staff/rooms/${m.roomId}`}>
                          <Badge tone="brand">{m.room.name}</Badge>
                        </Link>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
