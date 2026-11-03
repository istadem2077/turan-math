import { db } from "@/lib/db";
import { DOMAINS, DOMAIN_LABEL, DIFFICULTY_LABEL, type Choice } from "@/lib/taxonomy";
import { Badge, Card, cx } from "./ui";
import { MathText } from "./MathText";

export async function AttemptReview({ attemptId }: { attemptId: string }) {
  const attempt = await db.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      responses: true,
      room: { include: { test: { include: { items: { include: { question: { include: { skill: true } } }, orderBy: [{ module: "asc" }, { position: "asc" }] } } } } },
    },
  });
  const items = attempt.room.test?.items ?? [];
  const resp = new Map(attempt.responses.map((r) => [r.testItemId, r]));

  const byDomain = DOMAINS.map((d) => {
    const its = items.filter((i) => i.question.domain === d);
    return { d, total: its.length, correct: its.filter((i) => resp.get(i.id)?.isCorrect).length };
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Estimated score</div>
          <div className="mt-1 text-4xl font-bold">{attempt.scaledScore ?? "—"}</div>
          <div className="text-xs text-muted">on the 200–800 scale (estimate)</div>
        </Card>
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Correct answers</div>
          <div className="mt-1 text-4xl font-bold">
            {attempt.rawScore ?? 0}
            <span className="text-xl text-muted">/{items.length}</span>
          </div>
          <div className="text-xs text-muted">
            Module 1: {attempt.module1Raw ?? 0} · Module 2: {attempt.module2Raw ?? 0}
          </div>
        </Card>
        <Card>
          <div className="space-y-2">
            {byDomain.map(({ d, total, correct }) => (
              <div key={d}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{DOMAIN_LABEL[d]}</span>
                  <span className="text-muted">
                    {correct}/{total}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-canvas">
                  <div className="h-1.5 rounded-full bg-brand" style={{ width: `${total ? (correct / total) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {[1, 2].map((m) => (
        <Card key={m} title={`Module ${m}`}>
          <ol className="space-y-6">
            {items
              .filter((i) => i.module === m)
              .map((it) => {
                const r = resp.get(it.id);
                const q = it.question;
                const choices = (q.choices as Choice[] | null) ?? [];
                return (
                  <li key={it.id} className="border-b border-line pb-6 last:border-0 last:pb-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded bg-ink text-sm font-bold text-white">{it.position}</span>
                      {r?.isCorrect ? <Badge tone="ok">Correct</Badge> : r?.answer ? <Badge tone="bad">Incorrect</Badge> : <Badge tone="warn">Omitted</Badge>}
                      <Badge>{DOMAIN_LABEL[q.domain]}</Badge>
                      <Badge>{q.skill.name}</Badge>
                      <Badge>{DIFFICULTY_LABEL[q.difficulty]}</Badge>
                    </div>
                    <MathText className="font-serif text-[15px] leading-relaxed">{q.stem}</MathText>
                    {q.type === "MCQ" ? (
                      <div className="mt-3 grid gap-2">
                        {choices.map((c) => {
                          const isKey = c.key === q.correctChoice;
                          const picked = r?.answer === c.key;
                          return (
                            <div
                              key={c.key}
                              className={cx(
                                "flex items-start gap-3 rounded-lg border px-3 py-2 text-sm",
                                isKey ? "border-ok bg-ok-soft" : picked ? "border-bad bg-bad-soft" : "border-line",
                              )}
                            >
                              <span className="font-bold">{c.key}</span>
                              <MathText>{c.text}</MathText>
                              {picked && <span className="ml-auto text-xs font-semibold">Your answer</span>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-1 text-sm">
                        <div>
                          Your answer: <span className={cx("font-mono font-semibold", r?.isCorrect ? "text-ok" : "text-bad")}>{r?.answer || "—"}</span>
                        </div>
                        <div>
                          Accepted: <span className="font-mono font-semibold text-ok">{q.sprAnswers.join(", ")}</span>
                        </div>
                      </div>
                    )}
                    {q.explanation && (
                      <details className="mt-3 text-sm">
                        <summary className="cursor-pointer font-semibold text-brand">Explanation</summary>
                        <MathText className="mt-2 rounded-lg bg-canvas p-3">{q.explanation}</MathText>
                      </details>
                    )}
                  </li>
                );
              })}
          </ol>
        </Card>
      ))}
    </div>
  );
}
