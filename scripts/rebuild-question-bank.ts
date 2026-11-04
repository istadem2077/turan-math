/**
 * Rebuilds the question bank from scratch, in one go:
 *   1. empty it (scripts/reset-question-bank.ts)
 *   2. scrape College Board, OpenStax and AGIEval (each marks unsolvable questions)
 *   3. import the solvable ones as active
 *
 *   npm run questions:rebuild -- --yes [--include-unsolvable] [--offline] [--skip cbqb,openstax,agieval]
 * (the npm script first brings the database up to date with pending migrations)
 *
 *   --include-unsolvable  also import unsolvable questions: inactive, with the
 *                         reason shown in review mode (Status: Flagged)
 *   --offline             scrapers use their download caches only (fast; no new questions)
 *   --skip <sources>      leave sources out (e.g. if College Board is unreachable)
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

const args = process.argv.slice(2);
const has = (f: string) => args.includes(`--${f}`);
const skipArg = args.indexOf("--skip");
const skip = new Set(skipArg >= 0 ? args[skipArg + 1].split(",") : []);
const offline = has("offline") ? " --offline" : "";
const include = has("include-unsolvable") ? " --include-unsolvable" : "";

const SOURCES = [
  { name: "cbqb", scrape: `npx tsx scripts/cbqb/scrape.ts${offline}`, file: "data/cbqb/questions.json", figures: " --figures data/cbqb/figures" },
  { name: "openstax", scrape: `npx tsx scripts/sources/openstax.ts${offline}`, file: "data/openstax/questions.json", figures: "" },
  { name: "agieval", scrape: `npx tsx scripts/sources/agieval.ts${offline}`, file: "data/agieval/questions.json", figures: "" },
].filter((s) => !skip.has(s.name));

const run = (title: string, cmd: string) => {
  console.log(`\n━━ ${title}\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

if (!has("yes")) {
  console.log("This empties the question bank and rebuilds it from the scrapers. Run with --yes to go ahead.");
  process.exit(0);
}

// Scrape first: if a scraper fails, the current bank is still intact.
for (const s of SOURCES) run(`Scraping ${s.name}`, s.scrape);
for (const s of SOURCES) if (!existsSync(s.file)) throw new Error(`${s.file} is missing; did the ${s.name} scraper fail?`);

run("Emptying the question bank", "npx tsx scripts/reset-question-bank.ts --yes");
for (const s of SOURCES) run(`Importing ${s.name}`, `npx tsx scripts/import-questions.ts ${s.file}${s.figures}${include}`);
console.log(
  `\nDone. Review flagged questions under Question bank → Status: Flagged` + (include ? "." : " (none imported: add --include-unsolvable to bring them in)."),
);
