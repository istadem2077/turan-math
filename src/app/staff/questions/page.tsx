import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { Badge, Card, Empty, LinkButton, PageHeader, Select, Input, Button, Table } from "@/components/ui";
import { DIFFICULTIES, DIFFICULTY_LABEL, DOMAINS, DOMAIN_LABEL, DOMAIN_SHORT } from "@/lib/taxonomy";
import type { Prisma } from "@/generated/prisma/client";

const PAGE = 30;

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; skillId?: string; difficulty?: string; type?: string; q?: string; status?: string; page?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.QuestionWhereInput = {
    ...(sp.status === "inactive" ? { active: false } : sp.status === "all" ? {} : { active: true }),
    ...(sp.domain && { domain: sp.domain as never }),
    ...(sp.skillId && { skillId: Number(sp.skillId) }),
    ...(sp.difficulty && { difficulty: sp.difficulty as never }),
    ...(sp.type && { type: sp.type as never }),
    ...(sp.q && { stem: { contains: sp.q, mode: "insensitive" } }),
  };
  const [skills, total, rows, matrix] = await Promise.all([
    db.skill.findMany({ orderBy: { sortOrder: "asc" } }),
    db.question.count({ where }),
    db.question.findMany({ where, include: { skill: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.question.groupBy({ by: ["domain", "difficulty"], where: { active: true }, _count: true }),
  ]);
  const cell = (d: string, f: string) => matrix.find((m) => m.domain === d && m.difficulty === f)?._count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: number) => {
    const u = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
    u.set("page", String(p));
    return `?${u}`;
  };
  const isAdmin = me.role === "ADMIN";

  return (
    <>
      <PageHeader
        title="Question bank"
        subtitle="SAT Math questions by domain, skill and difficulty."
        actions={
          isAdmin && (
            <>
              <LinkButton variant="secondary" href="/staff/questions/import">
                Import
              </LinkButton>
              <LinkButton href="/staff/questions/new">New question</LinkButton>
            </>
          )
        }
      />
      <div className="space-y-6">
        <Card title="Coverage (active questions)">
          <Table>
            <thead>
              <tr>
                <th>Domain</th>
                {DIFFICULTIES.map((d) => (
                  <th key={d}>{DIFFICULTY_LABEL[d]}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {DOMAINS.map((d) => (
                <tr key={d}>
                  <td className="font-medium">{DOMAIN_LABEL[d]}</td>
                  {DIFFICULTIES.map((f) => (
                    <td key={f} className={cell(d, f) < 20 ? "font-semibold text-bad" : ""}>
                      {cell(d, f).toLocaleString()}
                    </td>
                  ))}
                  <td className="font-semibold">{DIFFICULTIES.reduce((s, f) => s + cell(d, f), 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        <form className="grid gap-2 rounded-xl border border-line bg-white p-4 md:grid-cols-3 lg:grid-cols-6">
          <Select name="domain" defaultValue={sp.domain ?? ""}>
            <option value="">All domains</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_LABEL[d]}
              </option>
            ))}
          </Select>
          <Select name="skillId" defaultValue={sp.skillId ?? ""}>
            <option value="">All skills</option>
            {DOMAINS.map((d) => (
              <optgroup key={d} label={DOMAIN_LABEL[d]}>
                {skills
                  .filter((s) => s.domain === d)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
          <Select name="difficulty" defaultValue={sp.difficulty ?? ""}>
            <option value="">All difficulties</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </Select>
          <Select name="type" defaultValue={sp.type ?? ""}>
            <option value="">All types</option>
            <option value="MCQ">Multiple choice</option>
            <option value="SPR">Student-produced</option>
          </Select>
          <Select name="status" defaultValue={sp.status ?? ""}>
            <option value="">Active</option>
            <option value="inactive">Retired</option>
            <option value="all">All</option>
          </Select>
          <div className="flex gap-2">
            <Input name="q" defaultValue={sp.q ?? ""} placeholder="Text…" />
            <Button variant="secondary">Filter</Button>
          </div>
        </form>

        {rows.length === 0 ? (
          <Empty>No questions match.</Empty>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Domain / skill</th>
                  <th>Difficulty</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => (
                  <tr key={q.id} className={q.active ? "" : "opacity-60"}>
                    <td className="max-w-md">
                      <Link href={`/staff/questions/${q.id}`} className="line-clamp-2 text-brand hover:underline">
                        {q.stem.replace(/\$/g, "").slice(0, 160)}
                      </Link>
                    </td>
                    <td>
                      <div className="font-medium">{DOMAIN_SHORT[q.domain]}</div>
                      <div className="text-xs text-muted">{q.skill.name}</div>
                    </td>
                    <td>{DIFFICULTY_LABEL[q.difficulty]}</td>
                    <td>{q.type === "MCQ" ? "MCQ" : <Badge tone="warn">SPR</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                {total.toLocaleString()} questions · page {page} of {pages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <LinkButton variant="secondary" href={qs(page - 1)}>
                    Previous
                  </LinkButton>
                )}
                {page < pages && (
                  <LinkButton variant="secondary" href={qs(page + 1)}>
                    Next
                  </LinkButton>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
