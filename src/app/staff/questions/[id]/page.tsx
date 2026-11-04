import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client-ui";
import { MathText } from "@/components/MathText";
import { DOMAIN_LABEL, DIFFICULTY_LABEL, type Choice } from "@/lib/taxonomy";
import { QuestionEditor } from "../QuestionEditor";
import { saveQuestion, setQuestionActive } from "../../actions";

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const { id } = await params;
  const q = await db.question.findUnique({ where: { id }, include: { skill: true, _count: { select: { testItems: true } } } });
  if (!q) notFound();
  const choices = (q.choices as Choice[] | null) ?? [];

  const header = (
    <>
      <Link href="/staff/questions" className="text-sm font-semibold text-brand hover:underline">
        ← Question bank
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            Question
            <Badge tone="brand">{DOMAIN_LABEL[q.domain]}</Badge>
            <Badge>{DIFFICULTY_LABEL[q.difficulty]}</Badge>
            {!q.active && <Badge tone="bad">Retired</Badge>}
          </span>
        }
        subtitle={`${q.skill.name}${q.externalId ? ` · ${q.externalId}` : ""} · used in ${q._count.testItems} test(s)`}
        actions={
          me.role === "ADMIN" &&
          (q.active ? (
            <ActionButton variant="danger" action={setQuestionActive.bind(null, id, false)} confirm="Retire this question? It won't be drawn into new tests.">
              Retire
            </ActionButton>
          ) : (
            <ActionButton action={setQuestionActive.bind(null, id, true)}>Reactivate</ActionButton>
          ))
        }
      />
    </>
  );

  if (me.role !== "ADMIN") {
    return (
      <>
        {header}
        <Card>
          <MathText className="font-serif text-[17px] leading-relaxed">{q.stem}</MathText>
          {q.type === "MCQ" ? (
            <ul className="mt-4 space-y-1">
              {choices.map((c) => (
                <li key={c.key} className={c.key === q.correctChoice ? "flex gap-2 font-semibold text-ok" : "flex gap-2"}>
                  {c.key}. <MathText>{c.text}</MathText>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 font-semibold text-ok">Accepted: {q.sprAnswers.join(", ")}</p>
          )}
          {q.explanation && <MathText className="mt-4 rounded-lg bg-canvas p-3 text-sm">{q.explanation}</MathText>}
        </Card>
      </>
    );
  }

  const skills = await db.skill.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <>
      {header}
      {q._count.testItems > 0 && (
        <div className="mb-4">
          <Notice tone="warn">This question is part of existing tests. Edits apply to them too (submitted attempts keep their recorded grades).</Notice>
        </div>
      )}
      <QuestionEditor
        action={saveQuestion.bind(null, id)}
        skills={skills}
        initial={{
          skillId: q.skillId,
          difficulty: q.difficulty,
          type: q.type,
          stem: q.stem,
          choices: Object.fromEntries(choices.map((c) => [c.key, c.text])),
          correctChoice: q.correctChoice ?? "A",
          sprAnswers: q.sprAnswers.join("|"),
          explanation: q.explanation ?? "",
          externalId: q.externalId ?? "",
        }}
      />
    </>
  );
}
