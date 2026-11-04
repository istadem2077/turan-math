/**
 * Collects SAT-style math exercises from OpenStax textbooks (openstax.org),
 * read from OpenStax's public GitHub repositories.
 *
 *   npx tsx scripts/sources/openstax.ts [--out data/openstax] [--books slug,slug] [--limit-modules n] [--offline]
 *
 * License: the book sources are CC BY-NC-SA 4.0 (© Rice University). Fine for
 * non-commercial teaching with attribution; derived question sets must be
 * shared under the same license. Every question's explanation carries the
 * attribution.
 *
 * Only exercises whose answer is a single number are kept (imported as
 * grid-in / SPR questions); exercises with several parts or non-numeric
 * answers are skipped. Exercises that need a figure (not downloaded) or
 * another exercise are kept but marked "unsolvable". Skills come from the book
 * section and difficulty is a heuristic.
 *
 * Then:  npx tsx scripts/import-questions.ts data/openstax/questions.json
 */
import { join } from "node:path";
import { htmlToMarkdown } from "../cbqb/convert";
import { arg, fetchCached, flag, numericAnswer, pool, writeOutput, type OutRow } from "./common";

type Book = { repo: string; slug: string; title: string; url: string; level: 0 | 1 | 2 };

const BOOKS: Book[] = [
  { repo: "osbooks-prealgebra-bundle", slug: "prealgebra-2e", title: "Prealgebra 2e", url: "https://openstax.org/details/books/prealgebra-2e", level: 0 },
  { repo: "osbooks-prealgebra-bundle", slug: "elementary-algebra-2e", title: "Elementary Algebra 2e", url: "https://openstax.org/details/books/elementary-algebra-2e", level: 0 },
  { repo: "osbooks-prealgebra-bundle", slug: "intermediate-algebra-2e", title: "Intermediate Algebra 2e", url: "https://openstax.org/details/books/intermediate-algebra-2e", level: 1 },
  { repo: "osbooks-college-algebra-bundle", slug: "college-algebra-2e", title: "College Algebra 2e", url: "https://openstax.org/details/books/college-algebra-2e", level: 1 },
  { repo: "osbooks-college-algebra-bundle", slug: "algebra-and-trigonometry-2e", title: "Algebra and Trigonometry 2e", url: "https://openstax.org/details/books/algebra-and-trigonometry-2e", level: 1 },
  { repo: "osbooks-introductory-statistics-bundle", slug: "introductory-statistics-2e", title: "Introductory Statistics 2e", url: "https://openstax.org/details/books/introductory-statistics-2e", level: 1 },
];
const DIFFICULTY = ["EASY", "MEDIUM", "HARD"] as const;
const RAW = (repo: string, path: string) => `https://raw.githubusercontent.com/openstax/${repo}/main/${path}`;

const OUT = arg("out") ?? "data/openstax";
const OFFLINE = flag("offline");
const ONLY = arg("books")?.split(",");
const LIMIT_MODULES = arg("limit-modules") ? Number(arg("limit-modules")) : Infinity;

// ---------------------------------------------------------------- skills

const DOMAIN_OF: Record<string, string> = {
  LIN_EQ_1VAR: "ALGEBRA", LIN_FUNC: "ALGEBRA", LIN_EQ_2VAR: "ALGEBRA", LIN_SYSTEMS: "ALGEBRA", LIN_INEQ: "ALGEBRA",
  NONLIN_FUNC: "ADVANCED_MATH", NONLIN_EQ: "ADVANCED_MATH", EQUIV_EXPR: "ADVANCED_MATH",
  RATIOS: "PROBLEM_SOLVING_DATA_ANALYSIS", PERCENT: "PROBLEM_SOLVING_DATA_ANALYSIS", DATA_1VAR: "PROBLEM_SOLVING_DATA_ANALYSIS",
  DATA_2VAR: "PROBLEM_SOLVING_DATA_ANALYSIS", PROBABILITY: "PROBLEM_SOLVING_DATA_ANALYSIS", INFERENCE: "PROBLEM_SOLVING_DATA_ANALYSIS",
  STAT_CLAIMS: "PROBLEM_SOLVING_DATA_ANALYSIS",
  AREA_VOLUME: "GEOMETRY_TRIGONOMETRY", LINES_ANGLES: "GEOMETRY_TRIGONOMETRY", RIGHT_TRIG: "GEOMETRY_TRIGONOMETRY", CIRCLES: "GEOMETRY_TRIGONOMETRY",
};

/** Chapters or sections the SAT doesn't cover (or pure arithmetic). */
const SKIP = new RegExp(
  [
    "whole numbers", "^(add|subtract|multiply|divide) ", "integers$", "visualize fractions", "multiples and factors", "prime factorization",
    "language of algebra", "introduction", "conic", "ellipse", "hyperbola", "rotation of axes", "polar", "sequence", "series", "binomial theorem",
    "matri", "gaussian", "cramer", "partial fractions", "three variables", "calculus", "periodic", "identities", "unit circle",
    "further applications of trig", "random variable", "normal distribution", "central limit", "hypothesis", "chi-square", "anova",
    "f distribution", "determinant", "experiment\\b.*\\(", "\\blab\\b", "inverses? of", "inverse functions", "systems of measurement", "healthcare",
  ].join("|"),
  "i",
);

/** First matching rule wins; tested against "| section", then "chapter |". */
const RULES: [RegExp, string][] = [
  [/pythagorean|properties of angles/i, "LINES_ANGLES"],
  [/right triangle/i, "RIGHT_TRIG"],
  [/circles and irregular/i, "CIRCLES"],
  [/volume|surface area|rectangles, triangles|perimeter/i, "AREA_VOLUME"],
  [/\bpercents?\b|sales tax|discount|\binterest\b/i, "PERCENT"],
  [/rates? of change/i, "LIN_FUNC"],
  [/\bratios?\b|\brates?\b|proportion|variation|uniform motion|mixture/i, "RATIOS"],
  [/probability|contingency|venn|counting/i, "PROBABILITY"],
  [/fitting exponential/i, "NONLIN_FUNC"],
  [/scatter|regression|fitting .* models|correlation/i, "DATA_2VAR"],
  [/\bmean\b|\bmedian\b|\bmode\b|\bspread\b|center of the data|location of the data|box plot|histogram|stem-and-leaf|descriptive|averages/i, "DATA_1VAR"],
  [/experimental design|ethics/i, "STAT_CLAIMS"],
  [/confidence interval|sampling and data|frequency tables/i, "INFERENCE"],
  [/complex number/i, "EQUIV_EXPR"],
  [/systems of nonlinear|other types of equations/i, "NONLIN_EQ"],
  [/\bsystems? of (linear )?equations|systems of linear/i, "LIN_SYSTEMS"],
  [/inequalit/i, "LIN_INEQ"],
  [/slope|graphing linear|graph linear|intercepts|rectangular coordinate|equation of a line|parallel and perpendicular|^graphs \|/i, "LIN_EQ_2VAR"],
  [/\| linear functions|^linear functions \||modeling with linear/i, "LIN_FUNC"],
  [/quadratic|exponential|logarithm|polynomial functions|rational functions|radical functions|power functions|zeros of|function/i, "NONLIN_FUNC"],
  [/polynomial|factor|exponent|scientific notation|radical|roots|rational expressions|complex numbers|properties of real numbers|monomials|square roots|algebra essentials/i, "EQUIV_EXPR"],
  [/linear equation|solve equations|solving equations|general strategy|problem.solving strategy|money applications|formula|math models|models and applications|applications/i, "LIN_EQ_1VAR"],
];

/** Section-level skill refined by the question's own wording. */
function refine(skill: string, section: string, text: string): string {
  const t = text.replace(/<[^>]+>/g, " ");
  if (DOMAIN_OF[skill] === "GEOMETRY_TRIGONOMETRY") {
    if (/pythagorean|hypotenuse|right triangle|\bladder\b|\blegs?\b/i.test(t)) return "RIGHT_TRIG";
    if (/\b(circle|radius|diameter|circumference)\b/i.test(t)) return "CIRCLES";
    if (/\b(area|perimeter|volume|surface area)\b/i.test(t)) return "AREA_VOLUME";
    if (/\b(angles?|degrees?)\b/i.test(t)) return "LINES_ANGLES";
  }
  // A single-number answer in an inequality section is usually an equation.
  const inequalityCue = /[<>≤≥]|&lt;|&gt;|\\[lg]eq?\b|<mo>\s*(&lt;|&gt;|≤|≥)|at (least|most)|maximum|minimum|no (more|less)|or (more|less)|exceed/i;
  if (skill === "LIN_INEQ" && !inequalityCue.test(t))
    return /quadratic|rational|absolute|radical/i.test(section) ? "NONLIN_EQ" : "LIN_EQ_1VAR";
  return skill;
}

function classify(chapter: string, section: string, instruction: string): string | null {
  if (SKIP.test(chapter) || SKIP.test(section)) return null;
  // Arithmetic chapters (fractions, decimals): keep only the equation-solving sections.
  if (/^(fractions|decimals)$/i.test(chapter) && !/\bsolve\b|averages|probability|\bratios?\b/i.test(section)) return null;
  // The section title is more specific; the chapter title is the fallback.
  const rule = RULES.find(([re]) => re.test(`| ${section}`)) ?? RULES.find(([re]) => re.test(`${chapter} |`));
  if (!rule) return null;
  if (DOMAIN_OF[rule[1]] === "PROBLEM_SOLVING_DATA_ANALYSIS" && /\b(mean|median|mode|average)\b/i.test(instruction)) return "DATA_1VAR";
  const solving = /\bsolve\b/i.test(instruction);
  if (solving && (rule[1] === "EQUIV_EXPR" || rule[1] === "NONLIN_FUNC")) return "NONLIN_EQ";
  return rule[1];
}

// ---------------------------------------------------------------- CNXML

type Chapter = { title: string; modules: string[] };

function parseCollection(xml: string): Chapter[] {
  const chapters: Chapter[] = [];
  for (const m of xml.matchAll(/<col:subcollection>\s*<md:title>([\s\S]*?)<\/md:title>([\s\S]*?)<\/col:subcollection>/g)) {
    chapters.push({ title: decode(m[1]), modules: [...m[2].matchAll(/document="(m\d+)"/g)].map((x) => x[1]) });
  }
  return chapters;
}

function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

/** CNXML fragment → HTML that scripts/cbqb/convert.ts understands (MathML is kept). */
function cnxmlToHtml(x: string): string {
  return x
    .replace(/<(\/?)m:/g, "<$1")
    .replace(/\sxmlns(:\w+)?="[^"]*"/g, "")
    .replace(/<footnote[\s\S]*?<\/footnote>/g, "")
    .replace(/<(\/?)para\b[^>]*>/g, "<$1p>")
    .replace(/<emphasis effect="bold"[^>]*>([\s\S]*?)<\/emphasis>/g, "<strong>$1</strong>")
    .replace(/<(\/?)emphasis\b[^>]*>/g, "<$1em>")
    .replace(/<(\/?)list\b[^>]*>/g, "<$1ul>")
    .replace(/<(\/?)item\b[^>]*>/g, "<$1li>")
    .replace(/<newline[^>]*\/>/g, "<br>")
    .replace(/<space[^>]*\/>/g, " ")
    .replace(/<(\/?)tgroup\b[^>]*>/g, "")
    .replace(/<colspec[^>]*\/>/g, "")
    .replace(/<(\/?)row\b[^>]*>/g, "<$1tr>")
    .replace(/<(\/?)entry\b[^>]*>/g, "<$1td>")
    .replace(/<(\/?)title\b[^>]*>/g, "<$1strong>");
}

const md = (cnxml: string, base: string) => htmlToMarkdown(cnxmlToHtml(cnxml), base).markdown;

/** "In the following exercises, solve each equation." → "Solve the equation." */
function singular(instruction: string): string {
  let s = instruction
    .replace(/^\s*(in|for) the following exercises?,?\s*/i, "")
    .replace(/\beach\b/gi, "the")
    .replace(/\bthe (\w+ )?(equation|expression|problem|inequality|system|formula)s\b/gi, "the $1$2")
    .trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// "approximate"/"decimal places": the book's answer often has a different precision than asked.
const NON_NUMERIC_TASK = /determine whether|graph|explain|write (an?|the)|translate|estimate|round|approximat|decimal places|identify|name the|list|sketch|describe|which of|true or false|in words|interval notation|set-builder|plot|fill in|missing|_{3,}|\\_\\_/i;

// ---------------------------------------------------------------- main

async function main() {
  const report = { modules: 0, exercises: 0, kept: 0, skipped: {} as Record<string, number>, unmappedSections: [] as string[] };
  const skip = (why: string) => (report.skipped[why] = (report.skipped[why] ?? 0) + 1);
  const rows: OutRow[] = [];
  const seenModules = new Set<string>();
  const jobs: { book: Book; chapter: string; module: string }[] = [];

  for (const book of BOOKS.filter((b) => !ONLY || ONLY.includes(b.slug))) {
    const coll = await fetchCached(RAW(book.repo, `collections/${book.slug}.collection.xml`), join(OUT, "raw", book.repo, `${book.slug}.collection.xml`), { offline: OFFLINE });
    if (!/by-nc-sa\/4\.0|by\/4\.0/.test(coll)) throw new Error(`${book.slug}: unexpected license, check before using`);
    for (const ch of parseCollection(coll))
      for (const module of ch.modules)
        if (!seenModules.has(module)) {
          seenModules.add(module); // books in a bundle share modules
          jobs.push({ book, chapter: ch.title, module });
        }
  }

  await pool(jobs.slice(0, LIMIT_MODULES), 4, async ({ book, chapter, module }) => {
    const xml = await fetchCached(RAW(book.repo, `modules/${module}/index.cnxml`), join(OUT, "raw", book.repo, `${module}.cnxml`), { offline: OFFLINE });
    report.modules++;
    const section = decode(/<title>([\s\S]*?)<\/title>/.exec(xml)?.[1] ?? "");
    if (!classify(chapter, section, "") && !classify(chapter, section, "solve")) {
      if (!SKIP.test(chapter) && !SKIP.test(section)) report.unmappedSections.push(`${book.slug}: ${chapter} | ${section}`);
      return;
    }

    // Walk exercises in order, remembering the latest "In the following exercises, …" instruction.
    // Readiness quizzes ("Be Prepared") review earlier topics, so they're dropped.
    const body = xml.replace(/<note\b[^>]*class="[^"]*be-prepared[^"]*"[\s\S]*?<\/note>/g, "");
    let instruction = "";
    for (const m of body.matchAll(/<section\b[^>]*>|<exercise\b[\s\S]*?<\/exercise>|<para\b[^>]*>([\s\S]*?)<\/para>/g)) {
      const tok = m[0];
      if (tok.startsWith("<section")) {
        instruction = "";
        continue;
      }
      if (tok.startsWith("<para")) {
        const text = md(tok, "x");
        if (/following exercise/i.test(text)) instruction = text;
        continue;
      }
      report.exercises++;
      const id = /<exercise\b[^>]*\bid="([^"]+)"/.exec(tok)?.[1];
      const problem = /<problem\b[^>]*>([\s\S]*?)<\/problem>/.exec(tok)?.[1];
      const solution = /<solution\b[^>]*>([\s\S]*?)<\/solution>/.exec(tok)?.[1];
      if (!id || !problem) { skip("malformed"); continue; }
      if (!solution) { skip("no answer in book"); continue; }
      // Problems that make it unsolvable as stored: kept and marked, not skipped.
      const problems: string[] = [];
      if (/<(figure|media|image)\b/.test(tok)) problems.push("has a figure that isn't included");
      if (/ⓐ|ⓑ/.test(tok)) { skip("several parts"); continue; }
      if (/if you missed this problem/i.test(tok)) { skip("readiness check"); continue; }
      if (/previous exercise|exercise above|exercises? \d/i.test(tok)) problems.push("depends on another exercise");
      if (!instruction && /^\s*<para[^>]*>\s*<m:math/.test(problem.trim())) { skip("no instruction"); continue; }

      const sectionSkill = classify(chapter, section, instruction + " " + problem);
      const skill = sectionSkill && refine(sectionSkill, section, instruction + " " + problem);
      if (!skill) { skip("section not mapped"); continue; }
      const task = singular(instruction);
      if (NON_NUMERIC_TASK.test(task) || NON_NUMERIC_TASK.test(problem.replace(/<[^>]+>/g, " "))) { skip("non-numeric task"); continue; }

      const answer = numericAnswer(md(solution, "s"));
      if (!answer) { skip("answer not a single grid-in number"); continue; }
      const body = md(problem, "p");
      if (!body) { skip("empty"); continue; }
      // Bare arithmetic ("−23.67 + 29.84", "convert 9.6 to a fraction") isn't SAT content.
      const words = body.replace(/\\text\{[^}]*\}|\\[a-zA-Z]+/g, "").replace(/\$[^$]*\$/g, (m) => m.replace(/\\[a-zA-Z]+/g, ""));
      if (!/[a-zA-Z]/.test(words) && !/\bsolve\b/i.test(task)) { skip("bare arithmetic"); continue; }
      if (/indicated operation|convert the|multiplicative inverse|additive inverse|opposite of|place value/i.test(task)) { skip("bare arithmetic"); continue; }

      // No numbers at all: the data lives in another exercise or a figure.
      if (!/\d/.test(task + body)) problems.push("its data is in another exercise or a figure");
      // Converter artifact: a currency "$" glued to math ("$$577.08$").
      if (/(^|[^\n])\$\$(?!\n)/.test(body)) { skip("formatting"); continue; }

      const wordy = body.replace(/\$[^$]*\$/g, "").length > 220;
      const difficulty = DIFFICULTY[Math.min(2, book.level + (wordy ? 1 : 0))];
      rows.push({
        externalId: `openstax:${module}:${id}`,
        domain: DOMAIN_OF[skill],
        skill,
        difficulty,
        type: "SPR",
        stem: task ? `${task}\n\n${body}` : body,
        answer: [answer],
        explanation:
          `Answer: ${answer}\n\n` +
          `*Source: OpenStax, ${book.title}, “${chapter}: ${section}”. © Rice University, licensed under ` +
          `[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). ${book.url}*`,
        ...(problems.length && { unsolvable: problems.join("; ") }),
      });
      report.kept++;
    }
  });

  writeOutput(OUT, rows, { ...report, unmappedSections: report.unmappedSections.sort() });
  console.log(`  modules read: ${report.modules}, exercises seen: ${report.exercises}, kept: ${report.kept}`);
  console.log(`  skipped: ${JSON.stringify(report.skipped)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
