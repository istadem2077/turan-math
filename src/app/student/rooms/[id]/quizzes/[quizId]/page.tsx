import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth";
import { getOrStartAttempt } from "@/lib/attempts";
import { buildExamState } from "@/lib/exam-state";
import { LocalTime } from "@/components/LocalTime";
import { Countdown } from "@/app/student/Countdown";
import { Exam } from "./exam/Exam";
import { AutoRefresh } from "@/components/AutoRefresh";

function Lobby({ title, roomId, children }: { title: string; roomId: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-white px-4">
      <div className="w-full max-w-lg text-center">
        <div className="bb-rule mb-8" />
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="mt-4 space-y-4 text-muted">{children}</div>
        <Link href={`/student/rooms/${roomId}`} className="mt-8 inline-block text-sm font-semibold text-brand hover:underline">
          ← Back to my room
        </Link>
      </div>
    </main>
  );
}

export default async function QuizPage({ params }: { params: Promise<{ id: string; quizId: string }> }) {
  const me = await requireStudent();
  const { id, quizId } = await params;
  const res = await getOrStartAttempt(id, quizId, me.id);
  if ("error" in res) {
    if (res.error === "NOT_FOUND") notFound();
    const quiz = res.quiz!;
    if (res.error === "NOT_OPEN")
      return (
        <Lobby title={quiz.title} roomId={id}>
          <AutoRefresh seconds={10} />
          Your professor hasn&apos;t started this quiz yet. Stay on this page; it will update when the quiz opens.
        </Lobby>
      );
    if (res.error === "NO_TEST")
      return (
        <Lobby title={quiz.title} roomId={id}>
          Your professor hasn&apos;t attached a test to this quiz yet. Check back soon.
        </Lobby>
      );
    if (res.error === "CLOSED")
      return (
        <Lobby title={quiz.title} roomId={id}>
          This quiz has ended.
        </Lobby>
      );
    return (
      <Lobby title={quiz.title} roomId={id}>
        <p>
          The quiz starts at <LocalTime iso={quiz.startsAt!.toISOString()} />. Stay on this page; it will open automatically.
        </p>
        <Countdown to={quiz.startsAt!.toISOString()} className="font-mono text-5xl font-bold tabular-nums text-ink" />
        <ul className="mx-auto max-w-sm space-y-1 text-left text-sm">
          <li>• 2 modules, 22 questions each, {quiz.moduleMinutes} minutes per module</li>
          <li>• Everyone starts at the same time; arriving late reduces your time in module 1</li>
          <li>• You can&apos;t return to module 1 once you move on</li>
          <li>• {quiz.calculatorAllowed ? "The Desmos graphing calculator is available" : "No calculator is allowed in this quiz"}</li>
        </ul>
      </Lobby>
    );
  }

  const { quiz, attempt } = res;
  if (attempt.status === "SUBMITTED") {
    return (
      <Lobby title="You're all finished!" roomId={id}>
        <p>Your answers have been submitted.</p>
        {quiz.resultsReleased ? (
          <Link href={`/student/rooms/${id}/quizzes/${quizId}/results`} className="font-semibold text-brand underline">
            View your results
          </Link>
        ) : (
          <p>Your professor will release your score when it&apos;s ready.</p>
        )}
      </Lobby>
    );
  }

  const state = await buildExamState(quiz, attempt);
  if (!state) notFound();
  return <Exam key={state.module} state={state} studentName={me.fullName} calculatorAllowed={quiz.calculatorAllowed} />;
}
