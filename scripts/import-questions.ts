/**
 * CLI bulk import for very large question dumps:
 *   npx tsx scripts/import-questions.ts path/to/questions.json|csv
 * Rows whose externalId already exists are skipped.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { db } from "../src/lib/db";
import { parseImportFile, toQuestionData } from "../src/lib/question-import";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: tsx scripts/import-questions.ts <file.json|file.csv>");
  const rows = parseImportFile(basename(file), readFileSync(file, "utf8"));
  const skills = await db.skill.findMany();
  const { ok, errors } = toQuestionData(rows, skills);
  for (const e of errors.slice(0, 50)) console.error(`Row ${e.row}: ${e.message}`);
  if (errors.length > 50) console.error(`...and ${errors.length - 50} more errors`);
  let inserted = 0;
  for (let i = 0; i < ok.length; i += 1000) {
    const res = await db.question.createMany({ data: ok.slice(i, i + 1000), skipDuplicates: true });
    inserted += res.count;
  }
  console.log(`Valid: ${ok.length}, inserted: ${inserted}, skipped (duplicate externalId): ${ok.length - inserted}, invalid: ${errors.length}`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
