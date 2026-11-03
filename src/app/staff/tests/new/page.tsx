import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { Builder, type PickedQuestion } from "./Builder";

export default async function NewTestPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const { from } = await searchParams;
  const skills = await db.skill.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, domain: true } });
  let initial: PickedQuestion[][] = [[], []];
  let title = "";
  if (from) {
    const src = await db.test.findUnique({
      where: { id: from },
      include: { items: { include: { question: { include: { skill: true } } }, orderBy: [{ module: "asc" }, { position: "asc" }] } },
    });
    if (src) {
      title = `${src.title} (copy)`;
      initial = [1, 2].map((m) =>
        src.items
          .filter((i) => i.module === m)
          .map((i) => ({ id: i.question.id, domain: i.question.domain, difficulty: i.question.difficulty, type: i.question.type, skill: i.question.skill.name, stem: i.question.stem })),
      );
    }
  }
  return (
    <>
      <Link href="/staff/tests" className="text-sm font-semibold text-brand hover:underline">
        ← Tests
      </Link>
      <PageHeader title="Build a test" subtitle="Filter the bank by domain, skill and difficulty, then add questions to each module (22 each)." />
      <Builder skills={skills} initial={initial} initialTitle={title} />
    </>
  );
}
