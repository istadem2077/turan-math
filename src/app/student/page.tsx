import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { Empty } from "@/components/ui";
import { AutoRefresh } from "@/components/AutoRefresh";
import { StudentShell } from "./Shell";
import { ActiveQuizCard, HomeworkRow, splitQuizzes } from "./items";
import { loadStudentRooms, needsHandIn } from "./data";

export default async function StudentHome() {
  const me = await requireStudent();
  const rooms = await loadStudentRooms(me.id);
  const now = new Date();
  const { active } = splitQuizzes(rooms.flatMap((r) => r.quizzes), now);
  active.sort((a, b) => a.startsAt!.getTime() - b.startsAt!.getTime());
  const due = rooms.flatMap((r) => r.homeworks).filter((h) => needsHandIn(h, now));

  return (
    <StudentShell name={me.fullName}>
      {/* Picks up quizzes the professor starts while this page is open. */}
      <AutoRefresh seconds={20} />
      <section>
        <h1 className="text-2xl font-bold">Hi, {me.fullName.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted">Your quizzes and homework.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Quizzes</h2>
        {active.length === 0 && <Empty>No quizzes right now. When your professor starts one, it appears here.</Empty>}
        {active.map((q) => (
          <ActiveQuizCard key={q.id} quiz={q} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Homework to hand in</h2>
        {due.length === 0 && <Empty>You&apos;re all caught up.</Empty>}
        {due.map((h) => (
          <HomeworkRow key={h.id} hw={h} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">My rooms</h2>
        {rooms.length === 0 && <Empty>You haven&apos;t been added to a room yet.</Empty>}
        <div className="grid gap-3 sm:grid-cols-2">
          {rooms.map((r) => (
            <Link key={r.id} href={`/student/rooms/${r.id}`} className="rounded-xl border border-line bg-white p-5 transition duration-150 hover:-translate-y-0.5 hover:border-brand hover:shadow-md hover:shadow-brand/5">
              <div className="text-lg font-semibold">{r.name}</div>
              <div className="mt-1 text-sm text-muted">
                {r.quizzes.length} quiz{r.quizzes.length === 1 ? "" : "zes"} · {r.homeworks.length} homework
              </div>
              <div className="mt-2 text-xs font-semibold text-brand">Open room →</div>
            </Link>
          ))}
        </div>
      </section>
    </StudentShell>
  );
}
