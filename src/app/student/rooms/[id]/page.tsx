import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { Empty } from "@/components/ui";
import { MaterialCard } from "@/components/MaterialCard";
import { AutoRefresh } from "@/components/AutoRefresh";
import { StudentShell } from "../../Shell";
import { ActiveQuizCard, HomeworkRow, PastQuizCard, splitQuizzes } from "../../items";
import { loadStudentRooms, needsHandIn } from "../../data";

export default async function StudentRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStudent();
  const { id } = await params;
  const [room] = await loadStudentRooms(me.id, id);
  if (!room) notFound();
  const now = new Date();
  const quizzes = room.quizzes.map((q) => ({ ...q, roomName: undefined }));
  const { active, past } = splitQuizzes(quizzes, now);
  active.sort((a, b) => a.startsAt!.getTime() - b.startsAt!.getTime());
  const homeworks = room.homeworks.map((h) => ({ ...h, roomName: undefined }));
  const openHw = homeworks.filter((h) => needsHandIn(h, now));
  const doneHw = homeworks.filter((h) => !openHw.includes(h)).reverse();

  return (
    <StudentShell name={me.fullName}>
      <AutoRefresh seconds={20} />
      <section>
        <Link href="/student" className="text-sm font-semibold text-brand hover:underline">
          ← Home
        </Link>
        <h1 className="text-2xl font-bold">{room.name}</h1>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Quizzes</h2>
        {active.length === 0 && <Empty>No quiz right now. When your professor starts one, it appears here.</Empty>}
        {active.map((q) => (
          <ActiveQuizCard key={q.id} quiz={q} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Homework</h2>
        {homeworks.length === 0 && <Empty>No homework in this room yet.</Empty>}
        {openHw.map((h) => (
          <HomeworkRow key={h.id} hw={h} />
        ))}
        {doneHw.length > 0 && (
          <>
            {openHw.length > 0 && <h3 className="pt-2 text-xs font-semibold tracking-wide text-muted uppercase">Handed in and past</h3>}
            {doneHw.map((h) => (
              <HomeworkRow key={h.id} hw={h} />
            ))}
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Lecture materials</h2>
        {room.materials.length === 0 && <Empty>No materials posted yet.</Empty>}
        {room.materials.map((m) => (
          <MaterialCard key={m.id} m={m} />
        ))}
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Past quizzes</h2>
          {past.map((q) => (
            <PastQuizCard key={q.id} quiz={q} />
          ))}
        </section>
      )}
    </StudentShell>
  );
}
