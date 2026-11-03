import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import {
  BLUEPRINT,
  MODULE_COUNT,
  QUESTIONS_PER_MODULE,
  fillModule,
  planModule,
  type Candidate,
  type FetchCandidates,
} from "./blueprint";

const fetchCandidates: FetchCandidates = async (filter, excludeIds, limit) => {
  const conds = [Prisma.sql`"active" = true`, Prisma.sql`"domain" = ${filter.domain}::"Domain"`];
  if (filter.difficulty) conds.push(Prisma.sql`"difficulty" = ${filter.difficulty}::"Difficulty"`);
  if (filter.type) conds.push(Prisma.sql`"type" = ${filter.type}::"QuestionType"`);
  if (excludeIds.length) conds.push(Prisma.sql`NOT ("id" = ANY(${excludeIds}::text[]))`);
  return db.$queryRaw<Candidate[]>`
    SELECT "id", "skillId" FROM "Question"
    WHERE ${Prisma.join(conds, " AND ")}
    ORDER BY random()
    LIMIT ${limit}`;
};

/** Draws a random 44-question test following the Bluebook blueprint. */
export async function generateAutoTest(title: string, createdById: string) {
  const used = new Set<string>();
  const modules: string[][] = [];
  for (const spec of BLUEPRINT) {
    modules.push(await fillModule(planModule(spec), fetchCandidates, used));
  }
  return createTest(title, "AUTO", createdById, modules);
}

export async function createTest(
  title: string,
  source: "AUTO" | "MANUAL",
  createdById: string,
  modules: string[][],
) {
  if (modules.length !== MODULE_COUNT || modules.some((m) => m.length !== QUESTIONS_PER_MODULE)) {
    throw new Error(`A test needs ${MODULE_COUNT} modules of ${QUESTIONS_PER_MODULE} questions.`);
  }
  const all = modules.flat();
  if (new Set(all).size !== all.length) throw new Error("A question can appear only once in a test.");
  const found = await db.question.count({ where: { id: { in: all } } });
  if (found !== all.length) throw new Error("Some selected questions no longer exist.");

  return db.test.create({
    data: {
      title,
      source,
      createdById,
      items: {
        create: modules.flatMap((ids, m) =>
          ids.map((questionId, p) => ({ module: m + 1, position: p + 1, questionId })),
        ),
      },
    },
  });
}
