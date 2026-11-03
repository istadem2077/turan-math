import Link from "next/link";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { reconcileAttempt } from "@/lib/attempts";
import { roomPhase } from "@/lib/timing";
import { Badge, Empty, LinkButton } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { Countdown } from "./Countdown";

export default async function StudentHome() {
  const me = await requireStudent();
  // Only rooms this student is a member of are ever queried.
  const memberships = await db.roomMember.findMany({
    where: { studentId: me.id },
    include: { room: { include: { attempts: { where: { studentId: me.id }, include: { room: true } } } } },
    orderBy: { room: { startsAt: "desc" } },
  });
  const now = new Date();
  const rows = await Promise.all(
    memberships.map(async ({ room }) => {
      const a = room.attempts[0] ? await reconcileAttempt(room.attempts[0]) : null;
      return { room, attempt: a, phase: roomPhase(room, now) };
    }),
  );
  const upcoming = rows.filter((r) => r.attempt?.status !== "SUBMITTED" && r.phase !== "FINISHED");
  const past = rows.filter((r) => !upcoming.includes(r));

  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 font-black">T</div>
            <span className="font-bold">Turan Math</span>
          </div>
          <form action={logout} className="flex items-center gap-4 text-sm">
            <span className="hidden text-white/80 sm:inline">{me.fullName}</span>
            <button className="font-semibold text-white/90 hover:text-white">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
        <section>
          <h1 className="text-2xl font-bold">Hi, {me.fullName.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted">Your scheduled SAT Math tests. Each test has 2 modules of 22 questions.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Upcoming</h2>
          {upcoming.length === 0 && <Empty>No upcoming tests.</Empty>}
          {upcoming.map(({ room, attempt, phase }) => (
            <div key={room.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white p-5">
              <div>
                <div className="text-lg font-semibold">{room.name}</div>
                <div className="text-sm text-muted">
                  <LocalTime iso={room.startsAt.toISOString()} /> · 2 × {room.moduleMinutes} min
                  {room.calculatorAllowed ? " · calculator allowed" : " · no calculator"}
                </div>
              </div>
              {phase === "SCHEDULED" ? (
                <div className="text-right">
                  <div className="text-xs text-muted">Starts in</div>
                  <Countdown to={room.startsAt.toISOString()} />
                </div>
              ) : !room.testId ? (
                <Badge tone="warn">Waiting for your professor</Badge>
              ) : (
                <LinkButton href={`/student/rooms/${room.id}`}>{attempt ? "Resume test" : "Start test"}</LinkButton>
              )}
            </div>
          ))}
        </section>

        {past.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Completed</h2>
            {past.map(({ room, attempt }) => (
              <div key={room.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white p-5">
                <div>
                  <div className="font-semibold">{room.name}</div>
                  <div className="text-sm text-muted">
                    <LocalTime iso={room.startsAt.toISOString()} mode="date" />
                  </div>
                </div>
                {!attempt ? (
                  <Badge tone="bad">Missed</Badge>
                ) : room.resultsReleased ? (
                  <Link href={`/student/rooms/${room.id}/results`} className="text-right">
                    <div className="text-2xl font-bold text-brand">{attempt.scaledScore}</div>
                    <div className="text-xs font-semibold text-brand">View results →</div>
                  </Link>
                ) : (
                  <Badge>Submitted · results pending</Badge>
                )}
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
