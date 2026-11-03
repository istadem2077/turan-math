import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Card, Empty, LinkButton, PageHeader, Table } from "@/components/ui";
import { LocalTime } from "@/components/LocalTime";
import { BLUEPRINT } from "@/lib/blueprint";
import { DOMAINS, DOMAIN_LABEL } from "@/lib/taxonomy";
import { GenerateForm } from "./GenerateForm";

export default async function TestsPage() {
  const tests = await db.test.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { fullName: true } }, _count: { select: { rooms: true } } },
  });
  return (
    <>
      <PageHeader
        title="Tests"
        subtitle="A test is a fixed 44-question form (2 modules × 22). Assign it to one or more rooms."
        actions={<LinkButton href="/staff/tests/new" variant="secondary">Build manually</LinkButton>}
      />
      <div className="space-y-6">
        <Card title="Generate a Bluebook-style test">
          <GenerateForm />
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold text-brand">How questions are picked</summary>
            <div className="mt-3 space-y-2 text-muted">
              <p>Questions are drawn at random from the active bank, following the digital SAT Math structure:</p>
              <Table>
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Module 1</th>
                    <th>Module 2</th>
                  </tr>
                </thead>
                <tbody>
                  {DOMAINS.map((d) => (
                    <tr key={d}>
                      <td>{DOMAIN_LABEL[d]}</td>
                      <td>{BLUEPRINT[0].domains[d]}</td>
                      <td>{BLUEPRINT[1].domains[d]}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <p>
                Each module has {BLUEPRINT[0].difficulty.EASY} easy, {BLUEPRINT[0].difficulty.MEDIUM} medium and {BLUEPRINT[0].difficulty.HARD} hard
                questions arranged from easier to harder with domains mixed, about {BLUEPRINT[0].spr} student-produced responses per module, and skills
                spread out within each domain. If the bank is short on an exact combination, a neighbouring difficulty or question type in the same domain
                is used.
              </p>
            </div>
          </details>
        </Card>

        {tests.length === 0 ? (
          <Empty>No tests yet.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Created</th>
                <th>Rooms</th>
              </tr>
            </thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/staff/tests/${t.id}`} className="font-semibold text-brand hover:underline">
                      {t.title}
                    </Link>
                  </td>
                  <td>{t.source === "AUTO" ? <Badge tone="brand">Random</Badge> : <Badge tone="warn">Hand-picked</Badge>}</td>
                  <td className="text-muted">
                    <LocalTime iso={t.createdAt.toISOString()} mode="date" /> · {t.createdBy?.fullName ?? "—"}
                  </td>
                  <td>{t._count.rooms}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </>
  );
}
