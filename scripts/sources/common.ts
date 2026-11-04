/**
 * Shared helpers for the question-source scrapers in this folder.
 * Output rows use the import format of scripts/import-questions.ts.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isValidSprInput } from "../../src/lib/grading";
import { fixDollarsInMath } from "../cbqb/convert";

export type OutRow = {
  externalId: string;
  domain: string;
  skill: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  type: "MCQ" | "SPR";
  stem: string;
  choices?: Record<string, string>;
  answer: string | string[];
  explanation?: string;
  /** Scraped questions are imported inactive so staff review them first. */
  active: boolean;
};

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
export const flag = (name: string) => process.argv.includes(`--${name}`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET with retries (2s, 4s, 8s, 16s), cached on disk so re-runs only fetch
 * what's missing. `offline` reads the cache only.
 */
export async function fetchCached(url: string, file: string, opts: { offline?: boolean; delayMs?: number } = {}): Promise<string> {
  if (existsSync(file)) return readFileSync(file, "utf8");
  if (opts.offline) throw new Error(`not in cache (offline): ${file}`);
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "turan-math-importer" }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 404) throw Object.assign(new Error(`404 ${url}`), { fatal: true });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const text = await res.text();
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, text);
      await sleep(opts.delayMs ?? 100);
      return text;
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal || attempt >= 5) throw e;
      await sleep(1000 * 2 ** attempt);
    }
  }
}

/** Runs `fn` over `items` with at most `n` in flight. */
export async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

const UNITS = [
  "inch(?:es)?", "in", "f(?:ee|oo)t", "ft", "yards?", "yd", "miles?", "mi", "mph", "centimeters?", "cm", "millimeters?", "mm", "meters?", "m",
  "kilometers?", "km", "grams?", "g", "kilograms?", "kg", "pounds?", "lbs?", "ounces?", "oz", "tons?", "gallons?", "gal", "quarts?", "pints?",
  "cups?", "liters?", "L", "milliliters?", "mL", "seconds?", "sec", "minutes?", "min", "hours?", "hrs?", "days?", "weeks?", "months?", "years?",
  "degrees?", "dollars?", "cents?", "people", "persons?", "students?", "tickets?", "units?", "items?", "times", "points?", "games?", "cars?",
  "books?", "boxes?", "bags?", "children", "adults?", "employees?", "workers?", "calories?", "percent",
].join("|");

/**
 * Turns an answer written in LaTeX/Markdown into a grid-in value, or null if it
 * isn't a single number the SAT answer grid can hold.
 *   "$x=5$" → "5", "$-\frac{3}{4}$" → "-3/4", "\$12.50" → "12.5", "25%" → "25", "14 feet" → "14"
 */
export function numericAnswer(raw: string): string | null {
  let s = raw
    .replace(/\$\$?/g, " ")
    .replace(/\\\$/g, "")
    .replace(/\\(left|right)\b/g, "")
    .replace(/\\(text|mathrm|textrm)\{([^}]*)\}/g, "$2")
    .replace(/\\[,;!: ]/g, "")
    .replace(/\\%|%/g, "")
    .replace(/[−–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/^[a-zA-Z]\s*=\s*/, ""); // "x = 5"
  s = s.replace(/^\\?\$\s*/, "");
  // Trailing unit words are allowed ("14 feet") but only from this list: anything
  // else may be a variable ("-11y", "2/3 ln x") and the answer isn't a number.
  const unit = String.raw`(?:\s+(?:(?:square|cubic|sq\.?)\s+)?(?:${UNITS})s?\.?(?:\s+(?:per|an?|each)\s+(?:${UNITS})s?)?)?$`;
  let m = new RegExp(String.raw`^(-?)\s*\\[dt]?frac\s*\{\s*(\d+)\s*\}\s*\{\s*(\d+)\s*\}` + unit).exec(s);
  let value: string | null = null;
  if (m) value = `${m[1]}${m[2]}/${m[3]}`;
  else if ((m = new RegExp(String.raw`^(-?)\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?|\.\d+)` + unit).exec(s))) {
    value = `${m[1]}${m[2].replace(/,/g, "")}`;
    if (value.includes(".")) value = value.replace(/0+$/, "").replace(/\.$/, "");
  }
  if (value === null || value === "-0") return null;
  return isValidSprInput(value) ? value : null;
}

/**
 * True when Markdown has broken math: LaTeX commands outside any $…$ span, or
 * an unmatched "$" (escaped currency "\$" is fine).
 */
export function brokenMath(md: string): boolean {
  let i = 0;
  while (i < md.length) {
    const c = md[i];
    if (c === "\\") {
      if (md[i + 1] === "$") i += 2; // escaped currency
      else if (/^\\[a-zA-Z]{2,}/.test(md.slice(i))) return true; // command outside math
      else i += 2;
      continue;
    }
    if (c !== "$") {
      i++;
      continue;
    }
    const delim = md.startsWith("$$", i) ? "$$" : "$";
    let j = i + delim.length;
    while (j < md.length && !md.startsWith(delim, j)) j += md[j] === "\\" ? 2 : 1;
    if (j >= md.length) return true; // unmatched "$"
    i = j + delim.length;
  }
  return false;
}

export function writeOutput(outDir: string, rows: OutRow[], report: Record<string, unknown>) {
  rows = [...rows];
  mkdirSync(outDir, { recursive: true });
  for (const r of rows) {
    r.stem = fixDollarsInMath(r.stem);
    if (r.explanation) r.explanation = fixDollarsInMath(r.explanation);
    if (r.choices) for (const k of Object.keys(r.choices)) r.choices[k] = fixDollarsInMath(r.choices[k]);
  }
  // Last guard: never write a question whose math would display broken.
  const broken = rows.filter((r) => brokenMath(r.stem) || Object.values(r.choices ?? {}).some(brokenMath));
  if (broken.length) {
    console.log(`  dropped ${broken.length} with broken math: ${broken.map((r) => r.externalId).join(", ")}`);
    rows = rows.filter((r) => !broken.includes(r));
  }
  rows.sort((a, b) => a.externalId.localeCompare(b.externalId));
  writeFileSync(join(outDir, "questions.json"), JSON.stringify(rows, null, 2));
  writeFileSync(join(outDir, "report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2));
  const by = (k: keyof OutRow) => rows.reduce<Record<string, number>>((acc, r) => ((acc[String(r[k])] = (acc[String(r[k])] ?? 0) + 1), acc), {});
  console.log(`\nWrote ${rows.length} questions to ${join(outDir, "questions.json")}`);
  console.log(`  by domain: ${JSON.stringify(by("domain"))}`);
  console.log(`  by skill: ${JSON.stringify(by("skill"))}`);
  console.log(`  by difficulty: ${JSON.stringify(by("difficulty"))}`);
}
