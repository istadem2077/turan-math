import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { getOrStartAttempt } from "@/lib/attempts";
import { buildExamState } from "@/lib/exam-state";
import { LocalTime } from "@/components/LocalTime";
import { Countdown } from "../../Countdown";
import { Exam } from "./exam/Exam";

function Lobby({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-white px-4">
      <div className="w-full max-w-lg text-center">
        <div className="bb-rule mb-8" />
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="mt-4 space-y-4 text-muted">{children}</div>
        <Link href="/student" className="mt-8 inline-block text-sm font-semibold text-brand hover:underline">
          ← Back to my tests
        </Link>
      </div>
    </main>
  );
}

export default async function RoomExamPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStudent();
  const { id } = await params;
  const res = await getOrStartAttempt(id, me.id);
  if ("error" in res) {
    if (res.error === "NOT_FOUND") notFound();
    const room = res.room!;
    if (res.error === "NO_TEST") return <Lobby title={room.name}>Your professor hasn&apos;t attached a test to this room yet. Check back soon.</Lobby>;
    if (res.error === "CLOSED") return <Lobby title={room.name}>This test has ended.</Lobby>;
    return (
      <Lobby title={room.name}>
        <p>
          The test starts at <LocalTime iso={room.startsAt.toISOString()} />. Stay on this page; it will open automatically.
        </p>
        <Countdown to={room.startsAt.toISOString()} className="font-mono text-5xl font-bold tabular-nums text-ink" />
        <ul className="mx-auto max-w-sm space-y-1 text-left text-sm">
          <li>• 2 modules, 22 questions each, {room.moduleMinutes} minutes per module</li>
          <li>• Everyone starts at the same time; arriving late reduces your time in module 1</li>
          <li>• You can&apos;t return to module 1 once you move on</li>
          <li>• {room.calculatorAllowed ? "The Desmos graphing calculator is available" : "No calculator is allowed in this test"}</li>
        </ul>
      </Lobby>
    );
  }

  const { room, attempt } = res;
  if (attempt.status === "SUBMITTED") {
    return (
      <Lobby title="You're all finished!">
        <p>Your answers have been submitted.</p>
        {room.resultsReleased ? (
          <Link href={`/student/rooms/${id}/results`} className="font-semibold text-brand underline">
            View your results
          </Link>
        ) : (
          <p>Your professor will release your score when it&apos;s ready.</p>
        )}
      </Lobby>
    );
  }

  const state = await buildExamState(room, attempt);
  if (!state) notFound();
  return <Exam key={state.module} state={state} studentName={me.fullName} calculatorAllowed={room.calculatorAllowed} />;
}
