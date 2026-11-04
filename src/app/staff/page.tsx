import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Card, Empty, LinkButton, PageHeader } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { PHASE_LABEL, PHASE_TONE, quizPhase } from "@/lib/rooms";

export default async function StaffHome() {
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const [students, questions, rooms, upcoming, recent, toGrade] = await Promise.all([
    db.user.count({ where: { role: "STUDENT", active: true } }),
    db.question.count({ where: { active: true } }),
    db.room.count(),
    db.quiz.findMany({
      where: { startsAt: { gte: recentCutoff } },
      orderBy: { startsAt: "asc" },
      take: 8,
      include: { room: { select: { name: true } } },
    }),
    db.quiz.findMany({
      where: { startsAt: { lt: recentCutoff } },
      orderBy: { startsAt: "desc" },
      take: 5,
      include: {
        room: { select: { name: true, _count: { select: { members: true } } } },
        attempts: { where: { status: "SUBMITTED" }, select: { rawScore: true } },
      },
    }),
    db.homework.findMany({
      where: { submissions: { some: { gradedAt: null } } },
      orderBy: { dueAt: "asc" },
      take: 8,
      include: { room: { select: { name: true } }, _count: { select: { submissions: { where: { gradedAt: null } } } } },
    }),
  ]);

  const stats = [
    { label: "Rooms", value: rooms, href: "/staff/rooms" },
    { label: "Active students", value: students, href: "/staff/students" },
    { label: "Questions in bank", value: questions, href: "/staff/questions" },
  ];

  return (
    <>
      <PageHeader title="Overview" actions={<LinkButton href="/staff/rooms">Go to rooms</LinkButton>} />
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-xl border border-line bg-white p-5 transition duration-150 hover:-translate-y-0.5 hover:border-brand hover:shadow-md hover:shadow-brand/5">
            <div className="text-3xl font-bold">{s.value.toLocaleString()}</div>
            <div className="mt-1 text-sm text-muted">{s.label}</div>
          </Link>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Live and scheduled quizzes">
          {upcoming.length === 0 ? (
            <Empty>Nothing running or scheduled. Start a quiz from a room&apos;s Quizzes tab.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((q) => {
                const phase = quizPhase(q, now);
                return (
                  <li key={q.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={`/staff/rooms/${q.roomId}/quizzes/${q.id}`} className="font-semibold text-brand hover:underline">
                        {q.title}
                      </Link>
                      <div className="text-xs text-muted">
                        {q.room.name} · <LocalTime iso={q.startsAt!.toISOString()} />
                      </div>
                    </div>
                    <Badge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card title="Homework to grade">
          {toGrade.length === 0 ? (
            <Empty>Nothing waiting to be graded.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {toGrade.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link href={`/staff/rooms/${h.roomId}/homework/${h.id}`} className="font-semibold text-brand hover:underline">
                      {h.title}
                    </Link>
                    <div className="text-xs text-muted">
                      {h.room.name} · due <LocalTime iso={h.dueAt.toISOString()} />
                    </div>
                  </div>
                  <Badge tone="warn">{h._count.submissions} to grade</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recent quiz results" className="lg:col-span-2">
          {recent.length === 0 ? (
            <Empty>No past quizzes yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((q) => {
                const n = q.attempts.length;
                const avg = n ? (q.attempts.reduce((s, a) => s + (a.rawScore ?? 0), 0) / n).toFixed(1) : "—";
                return (
                  <li key={q.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <Link href={`/staff/rooms/${q.roomId}/quizzes/${q.id}`} className="font-semibold text-brand hover:underline">
                        {q.title}
                      </Link>
                      <div className="text-xs text-muted">
                        {q.room.name} · {n}/{q.room._count.members} submitted · avg {avg}/44
                      </div>
                    </div>
                    {q.resultsReleased ? <Badge tone="ok">Released</Badge> : <Badge>Not released</Badge>}
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
