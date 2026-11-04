/**
 * Empties the question bank.
 *
 *   npx tsx scripts/reset-question-bank.ts --yes
 *
 * Questions used in a test can't be deleted without destroying the results
 * of everyone who took it, so those are kept and deactivated (they're never
 * drawn into new tests). Figures that no remaining question uses are removed.
 * Rooms, students, homework, tests and results are not touched.
 */
import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  if (!process.argv.includes("--yes")) {
    const n = await db.question.count();
    console.log(`This deletes ${n} questions (those used in tests are kept but deactivated). Run again with --yes to do it.`);
    return;
  }
  const { count: deleted } = await db.question.deleteMany({ where: { testItems: { none: {} } } });
  const { count: kept } = await db.question.updateMany({ data: { active: false } });

  // Figures still referenced by the questions that remain.
  const used = new Set<string>();
  for (const q of await db.question.findMany({ select: { stem: true, explanation: true, choices: true } }))
    for (const [, id] of JSON.stringify(q).matchAll(/\/api\/assets\/([a-z0-9]+)/g)) used.add(id);
  const { count: figures } = await db.asset.deleteMany({ where: { id: { notIn: [...used] } } });

  console.log(`Deleted ${deleted} questions and ${figures} unused figures.` + (kept ? ` Kept ${kept} used in tests (now inactive).` : ""));
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
