import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { Card, LinkButton, PageHeader, Select, Input, Button, Table } from "@/components/ui";
import { DIFFICULTIES, DIFFICULTY_LABEL, DOMAINS, DOMAIN_LABEL, DOMAIN_SHORT } from "@/lib/taxonomy";
import { SOURCE_LABEL, cleanFilters, filterQuery, questionWhere } from "@/lib/question-filters";
import { QuestionTable } from "./QuestionTable";

const PAGE = 30;

/** Plain-text preview of a stem for the list: LaTeX layout and Markdown removed. */
function snippet(stem: string) {
  return stem
    .replace(/\\\$/g, "\u0000") // keep prices ("\$12") while math "$" delimiters are removed
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "[figure]")
    .replace(/\\(begin|end)\{[^}]*\}/g, " ")
    .replace(/\\(d|t)?frac\{([^{}]*)\}\{([^{}]*)\}/g, "($2)/($3)")
    .replace(/\\(text|mathrm|mathbf)\{([^{}]*)\}/g, "$2")
    .replace(/\\\\|&|\$|\\(left|right)|[{}*_]{1,2}/g, " ")
    .replace(/\\([a-zA-Z]+)/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "$")
    .trim()
    .slice(0, 160);
}

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; skillId?: string; difficulty?: string; type?: string; q?: string; status?: string; source?: string; page?: string }>;
}) {
  const me = await requireStaff();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const filters = cleanFilters(sp);
  const where = questionWhere(filters);
  const [skills, total, rows, matrix] = await Promise.all([
    db.skill.findMany({ orderBy: { sortOrder: "asc" } }),
    db.question.count({ where }),
    db.question.findMany({ where, include: { skill: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.question.groupBy({ by: ["domain", "difficulty"], where: { active: true }, _count: true }),
  ]);
  // Where questions came from (externalId prefix), with how many are waiting for review.
  const sources = await db.$queryRaw<{ src: string; total: number; inactive: number }[]>`
    SELECT coalesce(substring("externalId" from '^[a-z]+'), 'none') AS src,
           count(*)::int AS total, count(*) FILTER (WHERE NOT active)::int AS inactive
    FROM "Question" GROUP BY 1 ORDER BY 2 DESC`;
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

        <form className="grid gap-2 rounded-xl border border-line bg-white p-4 md:grid-cols-3 lg:grid-cols-7">
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
          <Select name="source" defaultValue={sp.source ?? ""}>
            <option value="">All sources</option>
            {sources.map((x) => (
              <option key={x.src} value={x.src}>
                {SOURCE_LABEL[x.src] ?? x.src} ({x.total.toLocaleString()}
                {x.inactive ? `, ${x.inactive.toLocaleString()} inactive` : ""})
              </option>
            ))}
          </Select>
          <Select name="status" defaultValue={sp.status ?? ""}>
            <option value="">Active</option>
            <option value="inactive">Inactive (retired or to review)</option>
            <option value="all">All</option>
          </Select>
          <div className="flex gap-2">
            <Input name="q" defaultValue={sp.q ?? ""} placeholder="Text…" />
            <Button variant="secondary">Filter</Button>
          </div>
        </form>

        {/* The table stays mounted when empty, so a bulk action that empties the filter still shows its result. */}
        <>
            {isAdmin && total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 text-sm">
                <span className="text-muted">
                  {total.toLocaleString()} questions match. Review them one by one (keys <b>A</b> activate, <b>S</b> skip, <b>D</b> delete), or export them
                  to import on another site.
                </span>
                <span className="flex gap-2">
                  <a
                    href={`/api/questions/export?${filterQuery(filters)}`}
                    download
                    className="inline-flex items-center rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-semibold transition hover:bg-canvas"
                    title="Download these questions as a file for Question bank → Import on another site"
                  >
                    Export these
                  </a>
                  <LinkButton href={`/staff/questions/review?${filterQuery(filters)}`}>Review these</LinkButton>
                </span>
              </div>
            )}
            <QuestionTable
              total={total}
              filters={filters}
              canEdit={isAdmin}
              rows={rows.map((q) => ({
                id: q.id,
                stem: snippet(q.stem),
                domain: DOMAIN_SHORT[q.domain],
                skill: q.skill.name,
                difficulty: DIFFICULTY_LABEL[q.difficulty],
                type: q.type,
                active: q.active,
              }))}
            />
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
      </div>
    </>
  );
}
