import Link from "next/link";
import { Badge, LinkButton } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { quizPhase, type QuizPhase } from "@/lib/timing";
import type { Attempt, Homework, HomeworkSubmission, Quiz } from "@/generated/prisma/client";
import { Countdown } from "./Countdown";

export type StudentQuiz = Quiz & { attempt: Attempt | null; roomName?: string };

/** Quizzes the student can see: started or scheduled ones only. */
export function splitQuizzes(quizzes: StudentQuiz[], now = new Date()) {
  const visible = quizzes.map((q) => ({ ...q, phase: quizPhase(q, now) })).filter((q) => q.phase !== "NOT_STARTED");
  const active = visible.filter((q) => q.attempt?.status !== "SUBMITTED" && q.phase !== "FINISHED");
  const past = visible.filter((q) => !active.includes(q));
  return { active, past };
}

export function ActiveQuizCard({ quiz }: { quiz: StudentQuiz & { phase: QuizPhase } }) {
  const href = `/student/rooms/${quiz.roomId}/quizzes/${quiz.id}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white p-5">
      <div>
        <div className="text-lg font-semibold">{quiz.title}</div>
        <div className="text-sm text-muted">
          {quiz.roomName && <>{quiz.roomName} · </>}
          <LocalTime iso={quiz.startsAt!.toISOString()} /> · 2 × {quiz.moduleMinutes} min
          {quiz.calculatorAllowed ? " · calculator allowed" : " · no calculator"}
        </div>
      </div>
      {quiz.phase === "SCHEDULED" ? (
        <div className="text-right">
          <div className="text-xs text-muted">Starts in</div>
          <Countdown to={quiz.startsAt!.toISOString()} />
        </div>
      ) : quiz.phase === "LOBBY" ? (
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-muted">Starts in</div>
            <Countdown to={quiz.startsAt!.toISOString()} />
          </div>
          <LinkButton href={href}>Enter quiz</LinkButton>
        </div>
      ) : !quiz.testId ? (
        <Badge tone="warn">Waiting for your professor</Badge>
      ) : (
        <LinkButton href={href}>{quiz.attempt ? "Resume quiz" : "Start quiz"}</LinkButton>
      )}
    </div>
  );
}

export function PastQuizCard({ quiz }: { quiz: StudentQuiz }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-white p-5">
      <div>
        <div className="font-semibold">{quiz.title}</div>
        <div className="text-sm text-muted">
          <LocalTime iso={quiz.startsAt!.toISOString()} mode="date" />
        </div>
      </div>
      {!quiz.attempt ? (
        <Badge tone="bad">Missed</Badge>
      ) : quiz.resultsReleased ? (
        <Link href={`/student/rooms/${quiz.roomId}/quizzes/${quiz.id}/results`} className="text-right">
          <div className="text-2xl font-bold text-brand">{quiz.attempt.scaledScore}</div>
          <div className="text-xs font-semibold text-brand">View results →</div>
        </Link>
      ) : (
        <Badge>Submitted · results pending</Badge>
      )}
    </div>
  );
}

export type StudentHomework = Homework & { submission: HomeworkSubmission | null; roomName?: string };

export function homeworkStatus(h: StudentHomework, now = new Date()) {
  const s = h.submission;
  if (s?.gradedAt) return <Badge tone="ok">{s.score != null ? `Graded · ${s.score}/${h.maxPoints}` : "Response received"}</Badge>;
  if (s?.reopened) return <Badge tone="warn">Reopened · hand in again</Badge>;
  if (s) return <Badge tone="brand">Handed in{s.late ? " (late)" : ""}</Badge>;
  if (h.dueAt < now) return h.allowLate ? <Badge tone="warn">Overdue · late hand-in allowed</Badge> : <Badge tone="bad">Missed</Badge>;
  return <Badge>Not handed in</Badge>;
}

export function HomeworkRow({ hw }: { hw: StudentHomework }) {
  return (
    <Link
      href={`/student/rooms/${hw.roomId}/homework/${hw.id}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 transition hover:border-brand"
    >
      <div>
        <div className="font-semibold">{hw.title}</div>
        <div className="text-sm text-muted">
          {hw.roomName && <>{hw.roomName} · </>}Due <LocalTime iso={hw.dueAt.toISOString()} />
        </div>
      </div>
      {homeworkStatus(hw)}
    </Link>
  );
}
