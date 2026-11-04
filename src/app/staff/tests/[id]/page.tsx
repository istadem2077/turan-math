import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Badge, Card, LinkButton, PageHeader, Table } from "@/components/ui";
import { ActionButton } from "@/components/client-ui";
import { MathText } from "@/components/MathText";
import { DOMAINS, DOMAIN_LABEL, DOMAIN_SHORT, DIFFICULTY_LABEL, type Choice } from "@/lib/taxonomy";
import { deleteTest } from "../../actions";

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const test = await db.test.findUnique({
    where: { id },
    include: {
      items: { include: { question: { include: { skill: true } } }, orderBy: [{ module: "asc" }, { position: "asc" }] },
      quizzes: { select: { id: true, title: true, roomId: true, room: { select: { name: true } } } },
    },
  });
  if (!test) notFound();

  const items = test.items;
  const count = (m: number, pred: (q: (typeof items)[number]["question"]) => boolean) =>
    items.filter((i) => i.module === m && pred(i.question)).length;

  return (
    <>
      <Link href="/staff/tests" className="text-sm font-semibold text-brand hover:underline">
        ← Tests
      </Link>
      <PageHeader
        title={test.title}
        subtitle={test.source === "AUTO" ? "Randomly generated from the Bluebook blueprint" : "Hand-picked"}
        actions={
          <>
            <LinkButton variant="secondary" href={`/staff/tests/new?from=${id}`}>
              Copy &amp; edit
            </LinkButton>
            {test.quizzes.length === 0 && (
              <ActionButton variant="danger" action={deleteTest.bind(null, id)} confirm="Delete this test?">
                Delete
              </ActionButton>
            )}
          </>
        }
      />
      <div className="space-y-6">
        <Card title="Composition">
          <Table>
            <thead>
              <tr>
                <th></th>
                {DOMAINS.map((d) => (
                  <th key={d}>{DOMAIN_SHORT[d]}</th>
                ))}
                <th>E / M / H</th>
                <th>SPR</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2].map((m) => (
                <tr key={m}>
                  <td className="font-semibold">Module {m}</td>
                  {DOMAINS.map((d) => (
                    <td key={d}>{count(m, (q) => q.domain === d)}</td>
                  ))}
                  <td>
                    {count(m, (q) => q.difficulty === "EASY")} / {count(m, (q) => q.difficulty === "MEDIUM")} / {count(m, (q) => q.difficulty === "HARD")}
                  </td>
                  <td>{count(m, (q) => q.type === "SPR")}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          {test.quizzes.length > 0 && (
            <p className="mt-3 text-sm text-muted">
              Used by:{" "}
              {test.quizzes.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ", "}
                  <Link className="text-brand underline" href={`/staff/rooms/${r.roomId}/quizzes/${r.id}`}>
                    {r.room.name}: {r.title}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </Card>

        {[1, 2].map((m) => (
          <Card key={m} title={`Module ${m}`}>
            <ol className="space-y-5">
              {test.items
                .filter((i) => i.module === m)
                .map((it) => {
                  const q = it.question;
                  return (
                    <li key={it.id} className="border-b border-line pb-5 last:border-0 last:pb-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="grid h-7 w-7 place-items-center rounded bg-ink text-sm font-bold text-white">{it.position}</span>
                        <Badge tone="brand">{DOMAIN_LABEL[q.domain]}</Badge>
                        <Badge>{q.skill.name}</Badge>
                        <Badge>{DIFFICULTY_LABEL[q.difficulty]}</Badge>
                        {q.type === "SPR" && <Badge tone="warn">SPR</Badge>}
                        <Link href={`/staff/questions/${q.id}`} className="ml-auto text-xs font-semibold text-brand hover:underline">
                          Open
                        </Link>
                      </div>
                      <MathText className="font-serif text-[15px]">{q.stem}</MathText>
                      {q.type === "MCQ" ? (
                        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                          {((q.choices as Choice[]) ?? []).map((c) => (
                            <li key={c.key} className={c.key === q.correctChoice ? "flex gap-2 font-semibold text-ok" : "flex gap-2"}>
                              <span>{c.key}.</span>
                              <MathText>{c.text}</MathText>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm">
                          Answer: <span className="font-mono font-semibold text-ok">{q.sprAnswers.join(", ")}</span>
                        </p>
                      )}
                    </li>
                  );
                })}
            </ol>
          </Card>
        ))}
      </div>
    </>
  );
}
