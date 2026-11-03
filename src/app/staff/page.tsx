import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Card, Empty, LinkButton, PageHeader } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { PHASE_LABEL, PHASE_TONE, roomPhase } from "@/lib/rooms";

export default async function StaffHome() {
  const now = new Date();
  const soon = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const [students, questions, tests, rooms, recent] = await Promise.all([
    db.user.count({ where: { role: "STUDENT", active: true } }),
    db.question.count({ where: { active: true } }),
    db.test.count(),
    db.room.findMany({
      where: { startsAt: { gte: soon } },
      orderBy: { startsAt: "asc" },
      take: 8,
      include: { _count: { select: { members: true } }, test: { select: { title: true } } },
    }),
    db.room.findMany({
      where: { startsAt: { lt: soon } },
      orderBy: { startsAt: "desc" },
      take: 5,
      include: { attempts: { where: { status: "SUBMITTED" }, select: { rawScore: true } }, _count: { select: { members: true } } },
    }),
  ]);

  const stats = [
    { label: "Active students", value: students, href: "/staff/students" },
    { label: "Questions in bank", value: questions, href: "/staff/questions" },
    { label: "Tests", value: tests, href: "/staff/tests" },
  ];

  return (
    <>
      <PageHeader title="Overview" actions={<LinkButton href="/staff/rooms/new">Schedule a room</LinkButton>} />
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-xl border border-line bg-white p-5 transition hover:border-brand">
            <div className="text-3xl font-bold">{s.value.toLocaleString()}</div>
            <div className="mt-1 text-sm text-muted">{s.label}</div>
          </Link>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Upcoming and live rooms">
          {rooms.length === 0 ? (
            <Empty>Nothing scheduled.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {rooms.map((r) => {
                const phase = roomPhase(r, now);
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={`/staff/rooms/${r.id}`} className="font-semibold text-brand hover:underline">
                        {r.name}
                      </Link>
                      <div className="text-xs text-muted">
                        <LocalTime iso={r.startsAt.toISOString()} /> · {r._count.members} students
                        {!r.test && " · no test assigned"}
                      </div>
                    </div>
                    <Badge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="Recent results">
          {recent.length === 0 ? (
            <Empty>No past rooms yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((r) => {
                const n = r.attempts.length;
                const avg = n ? (r.attempts.reduce((s, a) => s + (a.rawScore ?? 0), 0) / n).toFixed(1) : "—";
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <Link href={`/staff/rooms/${r.id}`} className="font-semibold text-brand hover:underline">
                        {r.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {n}/{r._count.members} submitted · avg {avg}/44
                      </div>
                    </div>
                    {r.resultsReleased ? <Badge tone="ok">Released</Badge> : <Badge>Not released</Badge>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
