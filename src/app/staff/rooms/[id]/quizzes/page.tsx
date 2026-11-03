import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Empty, LinkButton, Table } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { PHASE_LABEL, PHASE_TONE, quizPhase } from "@/lib/rooms";
import { AutoRefresh } from "../client";

export default async function RoomQuizzesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [quizzes, memberCount] = await Promise.all([
    db.quiz.findMany({
      where: { roomId: id },
      orderBy: [{ startsAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      include: { test: { select: { title: true } }, attempts: { select: { status: true } } },
    }),
    db.roomMember.count({ where: { roomId: id } }),
  ]);
  const now = new Date();
  const anyActive = quizzes.some((q) => ["LOBBY", "LIVE"].includes(quizPhase(q, now)));
  return (
    <div className="space-y-4">
      {anyActive && <AutoRefresh seconds={20} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Start a quiz whenever you&apos;re ready, or schedule it ahead of time.</p>
        <LinkButton href={`/staff/rooms/${id}/quizzes/new`}>New quiz</LinkButton>
      </div>
      {quizzes.length === 0 ? (
        <Empty>No quizzes in this room yet.</Empty>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Quiz</th>
              <th>Start</th>
              <th>Test</th>
              <th>Submitted</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {quizzes.map((q) => {
              const phase = quizPhase(q, now);
              const submitted = q.attempts.filter((a) => a.status === "SUBMITTED").length;
              return (
                <tr key={q.id} className="hover:bg-canvas">
                  <td>
                    <Link href={`/staff/rooms/${id}/quizzes/${q.id}`} className="font-semibold text-brand hover:underline">
                      {q.title}
                    </Link>
                    <div className="text-xs text-muted">2 × {q.moduleMinutes} min</div>
                  </td>
                  <td className="whitespace-nowrap">{q.startsAt ? <LocalTime iso={q.startsAt.toISOString()} /> : <span className="text-muted">When you start it</span>}</td>
                  <td>{q.test?.title ?? <Badge tone="bad">No test</Badge>}</td>
                  <td>
                    {submitted}
                    <span className="text-muted"> / {memberCount}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={PHASE_TONE[phase]}>{PHASE_LABEL[phase]}</Badge>
                      {q.resultsReleased && <Badge tone="ok">Results released</Badge>}
                      {!q.calculatorAllowed && <Badge>No calculator</Badge>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
