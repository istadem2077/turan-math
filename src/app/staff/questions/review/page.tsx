import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Badge, Card, Empty, LinkButton, Notice, PageHeader } from "@/components/ui";
import { QuestionPreview } from "@/components/QuestionPreview";
import { DOMAIN_LABEL } from "@/lib/taxonomy";
import { SOURCE_LABEL, cleanFilters, filterQuery, questionWhere } from "@/lib/question-filters";
import { ReviewControls } from "./controls";

/**
 * Review mode: one question at a time, in a stable order (by id). `after` is
 * the last question handled, so skipping, activating and deleting all move on.
 */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const filters = cleanFilters(sp);
  const where = questionWhere(filters);
  const after = sp.after;
  const [q, remaining, total, skills] = await Promise.all([
    db.question.findFirst({ where: { AND: [where, after ? { id: { gt: after } } : {}] }, orderBy: { id: "asc" }, include: { skill: true } }),
    db.question.count({ where: { AND: [where, after ? { id: { gt: after } } : {}] } }),
    db.question.count({ where }),
    db.skill.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, domain: true } }),
  ]);
  const back = `/staff/questions?${filterQuery(filters)}`;

  if (!q)
    return (
      <>
        <PageHeader title="Review questions" />
        <Empty>
          Nothing left to review here.{" "}
          <Link href={back} className="font-semibold text-brand underline">
            Back to the question bank
          </Link>
        </Empty>
      </>
    );

  const src = q.externalId?.match(/^[a-z]+/)?.[0] ?? "none";
  return (
    <>
      <PageHeader
        title="Review questions"
        subtitle={`${remaining.toLocaleString()} left${total !== remaining ? ` (this session started with ${total.toLocaleString()} matching)` : ""}`}
        actions={
          <LinkButton variant="secondary" href={back}>
            Done
          </LinkButton>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card
          title={
            <span className="flex flex-wrap items-center gap-2">
              {DOMAIN_LABEL[q.domain]}
              {q.active ? <Badge tone="ok">Active</Badge> : <Badge tone="warn">Inactive</Badge>}
              <Badge>{SOURCE_LABEL[src] ?? src}</Badge>
            </span>
          }
        >
          <div key={q.id} className="anim-page space-y-4">
            {q.reviewNote && (
              <Notice tone="bad">
                <b>Flagged as unsolvable:</b> {q.reviewNote}. Press <b>E</b> to fix it in the editor, or <b>D</b> to delete it.
              </Notice>
            )}
            <QuestionPreview q={q} />
          </div>
        </Card>
        <ReviewControls
          key={q.id}
          question={{ id: q.id, skillId: q.skillId, difficulty: q.difficulty }}
          skills={skills}
          nextUrl={`/staff/questions/review?${filterQuery(filters, { after: q.id })}`}
        />
      </div>
    </>
  );
}
