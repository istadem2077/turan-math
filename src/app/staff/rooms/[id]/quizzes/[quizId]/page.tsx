import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { reconcileQuizAttempts } from "@/lib/attempts";
import { Badge, Card, Table, Notice, Empty } from "@/components/ui";
import { ActionButton } from "@/components/client-ui";
import { LocalTime } from "@/components/LocalTime";
import { Countdown } from "@/app/student/Countdown";
import { PHASE_LABEL, PHASE_TONE, quizPhase } from "@/lib/rooms";
import { LOBBY_MINUTES, quizEndsAt } from "@/lib/timing";
import { DOMAIN_SHORT, DIFFICULTY_LABEL } from "@/lib/taxonomy";
import { QuizForm } from "../QuizForm";
import { cancelQuizStart, deleteQuiz, resetAttempt, scheduleQuiz, setResultsReleased, startQuiz, updateQuiz } from "../../../actions";
import { AutoRefresh } from "../../client";
import { ScheduleForm } from "./controls";

export default async function QuizPage({ params }: { params: Promise<{ id: string; quizId: string }> }) {
  const { id, quizId } = await params;
  await reconcileQuizAttempts(quizId);
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, roomId: id },
    include: {
      test: { include: { items: { include: { question: { include: { skill: true } } }, orderBy: [{ module: "asc" }, { position: "asc" }] } } },
      attempts: true,
    },
  });
  if (!quiz) notFound();

  const [tests, members, answeredCounts, itemStats] = await Promise.all([
    db.test.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, title: true, source: true } }),
    db.roomMember.findMany({ where: { roomId: id }, include: { student: true }, orderBy: { student: { fullName: "asc" } } }),
    db.response.groupBy({ by: ["attemptId"], where: { attempt: { quizId }, answer: { not: null } }, _count: true }),
    db.response.groupBy({ by: ["testItemId", "isCorrect"], where: { attempt: { quizId, status: "SUBMITTED" } }, _count: true }),
  ]);

  const now = new Date();
  const phase = quizPhase(quiz, now);
  const startsIso = quiz.startsAt?.toISOString();
  const attemptBy = new Map(quiz.attempts.map((a) => [a.studentId, a]));
  const answeredBy = new Map(answeredCounts.map((c) => [c.attemptId, c._count]));
  const submitted = quiz.attempts.filter((a) => a.status === "SUBMITTED");
  const avg = submitted.length ? Math.round((submitted.reduce((s, a) => s + (a.rawScore ?? 0), 0) / submitted.length) * 10) / 10 : null;
  const correctByItem = new Map<string, number>();
  for (const s of itemStats) if (s.isCorrect) correctByItem.set(s.testItemId, s._count);
  // Students who are no longer in the room but sat this quiz still show up.
  const rows = [
    ...members.map((m) => m.student),
    ...(await db.user.findMany({ where: { id: { in: quiz.attempts.map((a) => a.studentId).filter((sid) => !members.some((m) => m.studentId === sid)) } } })),
  ];

  const startButton = (label: string) => (
    <ActionButton
      variant="primary"
      action={startQuiz.bind(null, quizId)}
      confirm={`Start "${quiz.title}" now? Students get ${LOBBY_MINUTES} minutes to enter, then module 1 begins for everyone.`}
    >
      {label}
    </ActionButton>
  );

  return (
    <div className="space-y-6">
      {(phase === "LOBBY" || phase === "LIVE") && <AutoRefresh seconds={15} />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/staff/rooms/${id}/quizzes`} className="text-sm font-semibold text-brand hover:underline">
            ← Quizzes
          </Link>
          <h2 className="flex flex-wrap items-center gap-3 text-xl font-bold">
            {quiz.title}
            <Badge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Badge>
          </h2>
          <p className="mt-1 text-sm text-muted">
            2 × {quiz.moduleMinutes} min · {quiz.calculatorAllowed ? "Desmos allowed" : "No calculator"} · {quiz.test?.title ?? "no test yet"}
          </p>
        </div>
        {quiz.resultsReleased ? (
          <ActionButton action={setResultsReleased.bind(null, quizId, false)}>Hide results from students</ActionButton>
        ) : (
          <ActionButton
            variant="primary"
            action={setResultsReleased.bind(null, quizId, true)}
            confirm="Students will see their score and a full review. Continue?"
          >
            Release results
          </ActionButton>
        )}
      </div>

      <Card title="Start">
        {!quiz.test && phase === "NOT_STARTED" ? (
          <Notice tone="warn">Choose a test in the settings below before starting or scheduling this quiz.</Notice>
        ) : phase === "NOT_STARTED" ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              {startButton("Start quiz")}
              <p className="text-sm text-muted">
                Students in this room see the quiz right away and have {LOBBY_MINUTES} minutes to enter before module 1 begins.
              </p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">
                Or schedule it <span className="font-normal text-muted">(optional)</span>
              </p>
              <ScheduleForm action={scheduleQuiz.bind(null, quizId)} label="Schedule" />
            </div>
          </div>
        ) : phase === "SCHEDULED" ? (
          <div className="space-y-5">
            <p className="text-sm">
              Scheduled for <b><LocalTime iso={startsIso!} /></b>. Students can see it now and enter {LOBBY_MINUTES} minutes before it begins.
            </p>
            <div className="flex flex-wrap gap-2">
              {startButton("Start now instead")}
              <ActionButton action={cancelQuizStart.bind(null, quizId)} confirm="Cancel the schedule? The quiz goes back to “not started” and students won't see it.">
                Cancel schedule
              </ActionButton>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Reschedule</p>
              <ScheduleForm action={scheduleQuiz.bind(null, quizId)} label="Reschedule" defaultIso={startsIso} />
            </div>
          </div>
        ) : phase === "LOBBY" ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm">Lobby is open. Module 1 begins for everyone in</p>
              <Countdown to={startsIso!} className="font-mono text-4xl font-bold tabular-nums" />
            </div>
            <ActionButton action={cancelQuizStart.bind(null, quizId)} confirm="Cancel the start? Students in the lobby will be sent back.">
              Cancel start
            </ActionButton>
          </div>
        ) : (
          <p className="text-sm">
            Started <b><LocalTime iso={startsIso!} /></b> · {phase === "LIVE" ? "closes by" : "closed"}{" "}
            <b><LocalTime iso={quizEndsAt(quiz).toISOString()} mode="time" /></b>
          </p>
        )}
      </Card>

      <Card
        title={`Students (${members.length})`}
        actions={
          avg !== null && (
            <span className="text-sm text-muted">
              {submitted.length} submitted · average {avg}/44
            </span>
          )
        }
      >
        {rows.length === 0 ? (
          <Empty>No students in this room yet.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Score</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((student) => {
                const a = attemptBy.get(student.id);
                let status;
                if (!a)
                  status =
                    phase === "FINISHED" ? (
                      <Badge tone="bad">Absent</Badge>
                    ) : phase === "LIVE" ? (
                      <Badge tone="warn">Not joined</Badge>
                    ) : (
                      <Badge>Waiting</Badge>
                    );
                else if (a.status === "SUBMITTED") status = <Badge tone="ok">Submitted</Badge>;
                else
                  status = (
                    <Badge tone="brand">
                      {a.status === "MODULE_1" ? "Module 1" : "Module 2"} · {answeredBy.get(a.id) ?? 0} answered
                    </Badge>
                  );
                return (
                  <tr key={student.id}>
                    <td>
                      <div className="font-medium">{student.fullName}</div>
                      <div className="text-xs text-muted">
                        @{student.username}
                        {!members.some((m) => m.studentId === student.id) && " · no longer in this room"}
                      </div>
                    </td>
                    <td>{status}</td>
                    <td>
                      {a?.status === "SUBMITTED" ? (
                        <Link href={`/staff/rooms/${id}/quizzes/${quizId}/students/${student.id}`} className="font-semibold text-brand hover:underline">
                          {a.rawScore}/44 <span className="font-normal text-muted">· ~{a.scaledScore}</span>
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      {a && (
                        <ActionButton
                          variant="ghost"
                          action={resetAttempt.bind(null, quizId, student.id)}
                          confirm={`Delete ${student.fullName}'s attempt so they can take this quiz again? Their answers will be lost.`}
                        >
                          Reset attempt
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="Settings">
        <QuizForm
          action={updateQuiz.bind(null, quizId)}
          tests={tests}
          submitLabel="Save settings"
          testLocked={quiz.attempts.length > 0}
          initial={{ title: quiz.title, moduleMinutes: quiz.moduleMinutes, calculatorAllowed: quiz.calculatorAllowed, testId: quiz.testId }}
        />
      </Card>

      {quiz.test && submitted.length > 0 && (
        <Card title="Question analysis" actions={<span className="text-sm text-muted">% of submitted students correct</span>}>
          <Table>
            <thead>
              <tr>
                <th>#</th>
                <th>Domain</th>
                <th>Skill</th>
                <th>Difficulty</th>
                <th className="text-right">Correct</th>
              </tr>
            </thead>
            <tbody>
              {quiz.test.items.map((it) => {
                const pct = Math.round(((correctByItem.get(it.id) ?? 0) / submitted.length) * 100);
                return (
                  <tr key={it.id}>
                    <td className="font-medium whitespace-nowrap">
                      M{it.module} · {it.position}
                    </td>
                    <td>{DOMAIN_SHORT[it.question.domain]}</td>
                    <td className="text-muted">{it.question.skill.name}</td>
                    <td>{DIFFICULTY_LABEL[it.question.difficulty]}</td>
                    <td className="text-right">
                      <span className={pct < 40 ? "font-semibold text-bad" : pct >= 75 ? "font-semibold text-ok" : ""}>{pct}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <div className="flex justify-end">
        <ActionButton variant="danger" action={deleteQuiz.bind(null, quizId)} confirm="Delete this quiz and all of its attempts? This can't be undone.">
          Delete quiz
        </ActionButton>
      </div>
    </div>
  );
}
