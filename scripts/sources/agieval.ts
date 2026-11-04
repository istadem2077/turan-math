/**
 * Collects the SAT-Math set of AGIEval (Microsoft; arXiv:2304.06364):
 * 220 multiple-choice questions with worked solutions, taken from official SAT
 * practice tests. https://github.com/ruixiangcui/AGIEval
 *
 *   npx tsx scripts/sources/agieval.ts [--out data/agieval] [--offline]
 *
 * License: the AGIEval README says use of the data must follow the original
 * sources' licenses. The questions are College Board material (same status as
 * scripts/cbqb): fine for your own students' practice; don't republish them.
 *
 * The data has no skill or difficulty labels, so skills are guessed from
 * keywords and difficulty is MEDIUM; questions that rely on a figure or table
 * that isn't in the data are skipped. Everything is written with active:false
 * for staff to review in Question bank → Status: Inactive.
 *
 * Then:  npx tsx scripts/import-questions.ts data/agieval/questions.json
 */
import { join } from "node:path";
import { missingContext } from "../../src/lib/question-checks";
import { arg, fetchCached, flag, writeOutput, type OutRow } from "./common";

const URL = "https://raw.githubusercontent.com/ruixiangcui/AGIEval/main/data/v1_1/sat-math.jsonl";
const OUT = arg("out") ?? "data/agieval";

type Item = { passage?: string | null; question: string; options: string[]; label: string; other?: { solution?: string } };

const DOMAIN_OF: Record<string, string> = {
  LIN_EQ_1VAR: "ALGEBRA", LIN_FUNC: "ALGEBRA", LIN_EQ_2VAR: "ALGEBRA", LIN_SYSTEMS: "ALGEBRA", LIN_INEQ: "ALGEBRA",
  NONLIN_FUNC: "ADVANCED_MATH", NONLIN_EQ: "ADVANCED_MATH", EQUIV_EXPR: "ADVANCED_MATH",
  RATIOS: "PROBLEM_SOLVING_DATA_ANALYSIS", PERCENT: "PROBLEM_SOLVING_DATA_ANALYSIS", DATA_1VAR: "PROBLEM_SOLVING_DATA_ANALYSIS",
  DATA_2VAR: "PROBLEM_SOLVING_DATA_ANALYSIS", PROBABILITY: "PROBLEM_SOLVING_DATA_ANALYSIS", INFERENCE: "PROBLEM_SOLVING_DATA_ANALYSIS",
  STAT_CLAIMS: "PROBLEM_SOLVING_DATA_ANALYSIS",
  AREA_VOLUME: "GEOMETRY_TRIGONOMETRY", LINES_ANGLES: "GEOMETRY_TRIGONOMETRY", RIGHT_TRIG: "GEOMETRY_TRIGONOMETRY", CIRCLES: "GEOMETRY_TRIGONOMETRY",
};

/** First match wins. Order matters: specific topics before generic algebra. */
const NONLINEAR = String.raw`\^\{?[2-9]|\sqrt|quadratic|exponential|parabola|polynomial|\b[a-z]\^`;
const RULES: [RegExp, string][] = [
  [/margin of error|confidence interval|random sample|sample of|surveyed|survey|researcher/i, "INFERENCE"],
  [/experiment|conclusion|cause/i, "STAT_CLAIMS"],
  [/probability|at random|chosen randomly/i, "PROBABILITY"],
  [/scatterplot|line of best fit|best fit|regression/i, "DATA_2VAR"],
  [/\b(mean|median|mode|standard deviation|range of)\b/i, "DATA_1VAR"],
  [/\b(sin|cos|tan)\b|\\(sin|cos|tan)|right triangle|hypotenuse|radians?/i, "RIGHT_TRIG"],
  [/circle|radius|diameter|\barc\b|circumference/i, "CIRCLES"],
  [/\b(area|volume|cube|cylinder|prism|sphere|cone|perimeter)\b/i, "AREA_VOLUME"],
  [/\b(angle|triangle|parallel|perpendicular lines|degrees?)\b/i, "LINES_ANGLES"],
  [new RegExp(`(system|intersect)[\\s\\S]*(${NONLINEAR})|(${NONLINEAR})[\\s\\S]*(system|intersect)`, "i"), "NONLIN_EQ"],
  [/sqrt\{-1\}|complex number|\bi\s*=/i, "EQUIV_EXPR"],
  [/equivalent|expression/i, "EQUIV_EXPR"],
  [/exponential|growth|decay|doubles|half-life/i, "NONLIN_FUNC"],
  [new RegExp(NONLINEAR, "i"), "NONLIN_EQ"],
  [/percent|%/i, "PERCENT"],
  [/\bratio\b|\brate\b|per (hour|minute|second|day|week)|miles|proportional|\bunits?\b|speed|grams?|liters?|meters|convert/i, "RATIOS"],
  [/system|intersect|solution to the system/i, "LIN_SYSTEMS"],
  [/inequalit|\\[lg]eq?\b|[<>≤≥]/i, "LIN_INEQ"],
  [/slope|intercept|xy-plane|graph of the line|line in the/i, "LIN_EQ_2VAR"],
  [/f\s*\(x\)|function/i, "LIN_FUNC"],
];

/** The data lost its figures and many tables; such questions can't be answered. */
const NEEDS_FIGURE = /\b(figure|shown|graph(ed)? (above|below)|table (above|below)|the table|scatterplot above|the graph|chart|diagram|data in the)\b/i;

/** "$\$ 2.60$" (a dollar sign inside math) breaks the Markdown math parser; write "\$2.60" instead. */
const money = (s: string) => s.replace(/\$\s*\\\$\s*([^$]*?)\s*\$/g, "\\$$$1");

const clean = (s: string) =>
  money(s)
    .replace(/^\([A-D]\)\s*/, "")
    .replace(/(\$)\s+\d{1,3}\s*$/, "$1") // page-number noise after math: "$15-6 i$ 3"
    .trim();

async function main() {
  const text = await fetchCached(URL, join(OUT, "raw", "sat-math.jsonl"), { offline: flag("offline") });
  const items: Item[] = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const rows: OutRow[] = [];
  const skipped: { index: number; reason: string }[] = [];

  items.forEach((it, i) => {
    const stem = [it.passage, it.question].filter(Boolean).join("\n\n").trim();
    if (NEEDS_FIGURE.test(stem)) return void skipped.push({ index: i, reason: "needs a figure or table that isn't in the data" });
    const missing = missingContext(stem);
    if (missing) return void skipped.push({ index: i, reason: missing });
    if (it.options?.length !== 4 || !/^[A-D]$/.test(it.label)) return void skipped.push({ index: i, reason: "not a 4-choice question" });
    const text = stem + " " + it.options.join(" ");
    const skill = RULES.find(([re]) => re.test(text))?.[1] ?? "LIN_EQ_1VAR";
    rows.push({
      externalId: `agieval:sat-math:${i}`,
      domain: DOMAIN_OF[skill],
      skill,
      difficulty: "MEDIUM",
      type: "MCQ",
      // The data glues display math to the next sentence ("$$...$$What is…").
      stem: money(stem).replace(/\$\$([^$]+)\$\$/g, "\n\n$$$$$1$$$$\n\n").replace(/\n{3,}/g, "\n\n").trim(),
      choices: Object.fromEntries(it.options.map((o, k) => ["ABCD"[k], clean(o)])),
      answer: it.label,
      explanation:
        `${money(it.other?.solution ?? "").trim()}\n\n` +
        `*Source: official SAT practice test (College Board), via the AGIEval benchmark (Microsoft, arXiv:2304.06364).*`,
      active: false,
    });
  });

  writeOutput(OUT, rows, { total: items.length, kept: rows.length, skipped });
  console.log(`  skipped ${skipped.length} (figures/tables missing from the data)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
