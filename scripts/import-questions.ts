/**
 * CLI bulk import for very large question dumps:
 *   npx tsx scripts/import-questions.ts path/to/questions.json|csv [--figures <dir>]
 * Rows whose externalId already exists are skipped.
 *
 * --figures <dir>: question text may reference figures as ![alt](figure:<file>)
 * (scripts/cbqb/scrape.ts writes them this way). Each referenced file is read
 * from <dir>, stored as an Asset, and the reference rewritten to
 * /api/assets/<id>. Only rows that will actually be inserted get assets.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { db } from "../src/lib/db";
import { parseImportFile, toQuestionData } from "../src/lib/question-import";

const MIME: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};
const FIGURE_REF = /\]\(figure:([^)\s]+)\)/g;

type Row = ReturnType<typeof toQuestionData>["ok"][number];

async function attachFigures(rows: Row[], dir: string) {
  const assetIds = new Map<string, string>();
  const resolve = async (text: string | null | undefined) => {
    if (!text) return text;
    const names = [...text.matchAll(FIGURE_REF)].map((m) => m[1]);
    for (const name of names) {
      if (assetIds.has(name)) continue;
      const mimeType = MIME[extname(name).toLowerCase()];
      if (!mimeType) throw new Error(`Unsupported figure type: ${name}`);
      const asset = await db.asset.create({
        data: { mimeType, filename: name, data: readFileSync(join(dir, basename(name))) },
        select: { id: true },
      });
      assetIds.set(name, asset.id);
    }
    return text.replace(FIGURE_REF, (_, name: string) => `](/api/assets/${assetIds.get(name)})`);
  };
  for (const row of rows) {
    row.stem = (await resolve(row.stem))!;
    row.explanation = (await resolve(row.explanation)) ?? undefined;
    if ("choices" in row && row.choices) for (const c of row.choices) c.text = (await resolve(c.text))!;
  }
  return assetIds.size;
}

async function main() {
  const args = process.argv.slice(2);
  const fi = args.indexOf("--figures");
  const figuresDir = fi >= 0 ? args[fi + 1] : undefined;
  const file = args.find((a, i) => !a.startsWith("--") && (fi < 0 || i !== fi + 1));
  if (!file) throw new Error("Usage: tsx scripts/import-questions.ts <file.json|file.csv> [--figures <dir>]");

  const rows = parseImportFile(basename(file), readFileSync(file, "utf8"));
  const skills = await db.skill.findMany();
  const { ok, errors } = toQuestionData(rows, skills);
  for (const e of errors.slice(0, 50)) console.error(`Row ${e.row}: ${e.message}`);
  if (errors.length > 50) console.error(`...and ${errors.length - 50} more errors`);

  // Drop rows that are already imported, so re-runs don't create orphan assets.
  const ids = ok.map((r) => r.externalId).filter((x): x is string => !!x);
  const existing = new Set(
    (await db.question.findMany({ where: { externalId: { in: ids } }, select: { externalId: true } })).map(
      (q: { externalId: string | null }) => q.externalId,
    ),
  );
  const fresh = ok.filter((r) => !r.externalId || !existing.has(r.externalId));

  const usesFigures = fresh.some((r) => JSON.stringify(r).includes("](figure:"));
  if (usesFigures && !figuresDir) throw new Error("Rows reference figure:… files; pass --figures <dir>");
  const assets = figuresDir ? await attachFigures(fresh, figuresDir) : 0;

  let inserted = 0;
  for (let i = 0; i < fresh.length; i += 1000) {
    const res = await db.question.createMany({ data: fresh.slice(i, i + 1000), skipDuplicates: true });
    inserted += res.count;
  }
  console.log(
    `Valid: ${ok.length}, inserted: ${inserted}, skipped (duplicate externalId): ${ok.length - inserted}, invalid: ${errors.length}, figures stored: ${assets}`,
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
