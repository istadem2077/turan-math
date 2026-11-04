/**
 * CLI bulk import (same as Question bank → Import, for very large files):
 *   npx tsx scripts/import-questions.ts <file.json|csv> [--figures <dir>] [--update] [--with-status]
 *
 * Rows whose externalId already exists are skipped, unless:
 *   --update        replace their text, choices, answer key, skill and difficulty
 *                   when they changed (e.g. after a scraper fix). Past attempts
 *                   keep their scores; review pages show the new text.
 *   --with-status   with --update, also apply each row's active/inactive value
 *                   (use it for files from Question bank → Export).
 *
 * Figures: ![alt](figure:<file>) is read from --figures <dir> (scrapers write
 * these); ![alt](data:image/…;base64,…) is embedded (exports write these).
 * Both become Assets. See src/lib/question-store.ts.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { db } from "../src/lib/db";
import { parseImportFile, toQuestionData } from "../src/lib/question-import";
import { importRows } from "../src/lib/question-store";

async function main() {
  const args = process.argv.slice(2);
  const fi = args.indexOf("--figures");
  const figuresDir = fi >= 0 ? args[fi + 1] : undefined;
  const file = args.find((a, i) => !a.startsWith("--") && (fi < 0 || i !== fi + 1));
  if (!file) throw new Error("Usage: tsx scripts/import-questions.ts <file.json|file.csv> [--figures <dir>] [--update] [--with-status]");

  const rows = parseImportFile(basename(file), readFileSync(file, "utf8"));
  const { ok, errors } = toQuestionData(rows, await db.skill.findMany());
  for (const e of errors.slice(0, 50)) console.error(`Row ${e.row}: ${e.message}`);
  if (errors.length > 50) console.error(`...and ${errors.length - 50} more errors`);

  const r = await importRows(ok, {
    update: args.includes("--update"),
    withStatus: args.includes("--with-status"),
    figureFile: figuresDir ? (name) => readFileSync(join(figuresDir, basename(name))) : undefined,
  });
  console.log(
    `Valid: ${ok.length}, inserted: ${r.inserted}, updated: ${r.updated}, skipped (already there): ${r.skipped}, invalid: ${errors.length}, figures stored: ${r.figures}`,
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
