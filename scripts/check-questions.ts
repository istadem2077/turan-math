/**
 * Finds questions in the bank that can't be answered as stored: they refer to
 * something "above" or to a figure, graph or table that isn't in the text
 * (see src/lib/question-checks.ts).
 *
 *   npx tsx scripts/check-questions.ts                 # list problems (changes nothing)
 *   npx tsx scripts/check-questions.ts --source cbqb   # only externalIds starting "cbqb:"
 *   npx tsx scripts/check-questions.ts --deactivate    # also set them inactive
 *
 * Deactivated questions get the reason as a review note: fix and activate them
 * under Question bank → Status: Flagged.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { missingContext } from "../src/lib/question-checks";

async function main() {
  const args = process.argv.slice(2);
  const si = args.indexOf("--source");
  const source = si >= 0 ? args[si + 1] : undefined;
  const deactivate = args.includes("--deactivate");

  const questions = await db.question.findMany({
    where: { active: true, ...(source && { externalId: { startsWith: `${source}:` } }) },
    select: { id: true, externalId: true, stem: true },
  });
  const bad = questions.flatMap((q) => {
    const why = missingContext(q.stem);
    return why ? [{ ...q, why }] : [];
  });

  for (const q of bad) console.log(`${q.externalId ?? q.id}  ${q.why}\n    ${q.stem.replace(/\s+/g, " ").slice(0, 110)}`);
  console.log(`\nChecked ${questions.length} active questions; ${bad.length} can't be answered as stored.`);

  if (bad.length && deactivate) {
    for (const q of bad) await db.question.update({ where: { id: q.id }, data: { active: false, reviewNote: q.why } });
    console.log(`Set ${bad.length} inactive and flagged (Question bank → Status: Flagged).`);
  } else if (bad.length) {
    console.log("Run again with --deactivate to take them out of rotation.");
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
