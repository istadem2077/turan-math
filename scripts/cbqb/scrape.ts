/**
 * Scrapes SAT Math questions from College Board's SAT Suite Question Bank
 * (satsuitequestionbank.collegeboard.org) into Turan Math's import format.
 *
 *   npx tsx scripts/cbqb/scrape.ts [options]
 *
 *   --out <dir>          output directory            (default: data/cbqb)
 *   --domains H,P,Q,S    CB domain codes to fetch    (default: all four)
 *   --limit <n>          only the first n questions  (for a test run)
 *   --concurrency <n>    parallel item requests      (default: 3)
 *   --delay <ms>         pause after each request    (default: 250)
 *   --offline            convert from the raw cache only, no network
 *   --probe              fetch the list + 1 item, print the raw JSON, exit
 *
 * Output:
 *   <out>/questions.json   array for scripts/import-questions.ts
 *   <out>/figures/         SVG/PNG figures referenced as ![](figure:<name>)
 *   <out>/report.json      unmapped skills, failures, remote images
 *   <out>/raw/             cached API responses (re-runs only fetch what's missing)
 *
 * Then:
 *   npx tsx scripts/import-questions.ts data/cbqb/questions.json --figures data/cbqb/figures
 *
 * The Question Bank has no public API contract: the endpoints below are the
 * ones its web front-end calls. If College Board changes them, open the site
 * with devtools -> Network, run a search, and update ENDPOINTS / the field
 * names in normalizeItem(). --probe shows what the API currently returns.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SKILLS } from "../../src/lib/taxonomy";
import { htmlToMarkdown, remoteImages, type Figure } from "./convert";
import { missingContext } from "../../src/lib/question-checks";

const ENDPOINTS = {
  list: "https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-questions",
  item: "https://qbank-api.collegeboard.org/msreportingquestionbank-prod/questionbank/digital/get-question",
  /** Older items carry an `ibn` instead of an `external_id` and are served as static JSON. */
  disclosed: (ibn: string) => `https://saic.collegeboard.org/disclosed/${ibn}.json`,
};
const ASSESSMENT_SAT = 99;
const TEST_MATH = 2;

const DOMAIN_BY_CODE: Record<string, string> = {
  H: "ALGEBRA",
  P: "ADVANCED_MATH",
  Q: "PROBLEM_SOLVING_DATA_ANALYSIS",
  S: "GEOMETRY_TRIGONOMETRY",
};
const DIFFICULTY_BY_CODE: Record<string, string> = { E: "EASY", M: "MEDIUM", H: "HARD" };

// ---------------------------------------------------------------- args

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const OUT = arg("out") ?? "data/cbqb";
const DOMAINS = (arg("domains") ?? "H,P,Q,S").toUpperCase();
const LIMIT = arg("limit") ? Number(arg("limit")) : Infinity;
const CONCURRENCY = Number(arg("concurrency") ?? 3);
const DELAY = Number(arg("delay") ?? 250);
const OFFLINE = flag("offline");
const PROBE = flag("probe");

const RAW = join(OUT, "raw");
const RAW_ITEMS = join(RAW, "items");
const FIGURES = join(OUT, "figures");
for (const d of [OUT, RAW, RAW_ITEMS, FIGURES]) mkdirSync(d, { recursive: true });

// ---------------------------------------------------------------- http

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  Origin: "https://satsuitequestionbank.collegeboard.org",
  Referer: "https://satsuitequestionbank.collegeboard.org/",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) turan-math-importer",
};

async function request(url: string, body?: unknown, attempt = 1): Promise<unknown> {
  try {
    const res = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: HEADERS,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${url}`), { fatal: true });
    return await res.json();
  } catch (e) {
    if ((e as { fatal?: boolean }).fatal || attempt >= 5) throw e;
    await sleep(1000 * 2 ** attempt); // 2s, 4s, 8s, 16s
    return request(url, body, attempt + 1);
  } finally {
    await sleep(DELAY);
  }
}

function cached<T>(file: string, fetcher: () => Promise<T>): Promise<T> {
  if (existsSync(file)) return Promise.resolve(JSON.parse(readFileSync(file, "utf8")));
  if (OFFLINE) return Promise.reject(new Error(`not in cache (offline): ${file}`));
  return fetcher().then((data) => {
    writeFileSync(file, JSON.stringify(data, null, 1));
    return data;
  });
}

// ---------------------------------------------------------------- data shapes

/** One row of the list endpoint (only the fields we use). */
type Meta = {
  questionId?: string;
  external_id?: string | null;
  ibn?: string | null;
  primary_class_cd?: string;
  skill_cd?: string;
  skill_desc?: string;
  difficulty?: string;
  uId?: string;
};

/** Item content normalized across the two item sources. */
type Item = {
  type: "MCQ" | "SPR";
  stimulus: string;
  stem: string;
  options: string[]; // HTML, in A–D order
  correct: string[]; // MCQ: one letter. SPR: accepted answers.
  rationale: string;
};

const s = (v: unknown) => (typeof v === "string" ? v : "");

function splitSpr(values: unknown[]): string[] {
  // CB sometimes packs several accepted forms into one string: "3/4, .75".
  // Split on comma+space only, so "1,200" stays intact.
  return values
    .flatMap((v) => String(v).split(/,\s+|\s*\|\s*/))
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeItem(raw: unknown): Item {
  // disclosed/{ibn}.json returns an array with one item
  const r = (Array.isArray(raw) ? raw[0] : raw) as Record<string, any>;
  if (!r || typeof r !== "object") throw new Error("empty item");

  // --- shape A: get-question
  if ("stem" in r || "answerOptions" in r) {
    const options: { id?: string; content?: string }[] = Array.isArray(r.answerOptions) ? r.answerOptions : [];
    const isSpr = s(r.type).toLowerCase() === "spr" || options.length === 0;
    const correctRaw: unknown[] = Array.isArray(r.correct_answer) ? r.correct_answer : [];
    let correct: string[];
    if (isSpr) {
      correct = splitSpr(correctRaw);
    } else {
      const letter = correctRaw.map(String).find((v) => /^[A-D]$/i.test(v.trim()));
      if (letter) correct = [letter.trim().toUpperCase()];
      else {
        const key = Array.isArray(r.keys) ? String(r.keys[0]) : "";
        const i = options.findIndex((o) => o.id === key);
        correct = i >= 0 ? ["ABCD"[i]] : [];
      }
    }
    return {
      type: isSpr ? "SPR" : "MCQ",
      stimulus: s(r.stimulus),
      stem: s(r.stem),
      options: options.map((o) => s(o.content)),
      correct,
      rationale: s(r.rationale),
    };
  }

  // --- shape B: disclosed/{ibn}.json
  if ("answer" in r) {
    const a = r.answer ?? {};
    const choices = a.choices && typeof a.choices === "object" ? a.choices : {};
    const keys = Object.keys(choices).sort(); // a, b, c, d
    const isSpr = keys.length === 0;
    return {
      type: isSpr ? "SPR" : "MCQ",
      stimulus: "",
      stem: s(r.prompt) || s(r.body),
      options: keys.map((k) => s(choices[k]?.body)),
      correct: isSpr
        ? splitSpr([].concat(a.correct_answer ?? a.correct_choice ?? []))
        : [s(a.correct_choice).trim().toUpperCase()].filter(Boolean),
      rationale: s(a.rationale),
    };
  }

  throw new Error(`unknown item shape (keys: ${Object.keys(r).slice(0, 12).join(", ")})`);
}

// ---------------------------------------------------------------- skills

const norm = (x: string) =>
  x
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const SKILL_BY_NAME = new Map(SKILLS.map((k) => [norm(k.name), k]));

function mapSkill(desc: string, domain: string) {
  const exact = SKILL_BY_NAME.get(norm(desc));
  if (exact && exact.domain === domain) return exact;
  // Fallback: same domain, name starts the same way (CB occasionally shortens names).
  const n = norm(desc);
  return SKILLS.find((k) => k.domain === domain && (norm(k.name).startsWith(n) || n.startsWith(norm(k.name))));
}

// ---------------------------------------------------------------- main

type OutRow = {
  externalId: string;
  domain: string;
  skill: string;
  difficulty: string;
  type: "MCQ" | "SPR";
  stem: string;
  choices?: Record<string, string>;
  answer: string | string[];
  explanation?: string;
};

async function fetchList(): Promise<Meta[]> {
  const file = join(RAW, `list-${DOMAINS.replace(/,/g, "")}.json`);
  const data = await cached(file, () =>
    request(ENDPOINTS.list, { asmtEventId: ASSESSMENT_SAT, test: TEST_MATH, domain: DOMAINS }),
  );
  if (!Array.isArray(data)) throw new Error(`list endpoint returned ${typeof data}, expected an array`);
  return data as Meta[];
}

function fetchItem(m: Meta): Promise<unknown> {
  const id = m.questionId ?? m.uId ?? m.external_id ?? m.ibn;
  const file = join(RAW_ITEMS, `${id}.json`);
  if (m.external_id) return cached(file, () => request(ENDPOINTS.item, { external_id: m.external_id }));
  if (m.ibn) return cached(file, () => request(ENDPOINTS.disclosed(m.ibn!)));
  return Promise.reject(new Error("row has neither external_id nor ibn"));
}

async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
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

async function main() {
  const list = await fetchList();

  if (PROBE) {
    console.log(`List: ${list.length} rows. First row:\n`, JSON.stringify(list[0], null, 2));
    const item = await fetchItem(list[0]);
    console.log("\nFirst item (raw):\n", JSON.stringify(item, null, 2).slice(0, 4000));
    return;
  }

  const metas = list.filter((m) => DOMAIN_BY_CODE[m.primary_class_cd ?? ""]).slice(0, LIMIT);
  console.log(`${list.length} rows listed, processing ${metas.length}`);

  const rows: OutRow[] = [];
  const failures: { id: string; error: string }[] = [];
  const unmappedSkills = new Map<string, number>();
  const remote: { id: string; url: string }[] = [];
  let figureCount = 0;
  let done = 0;

  await pool(metas, CONCURRENCY, async (m) => {
    const qid = m.questionId ?? m.uId ?? m.external_id ?? m.ibn ?? "?";
    try {
      const domain = DOMAIN_BY_CODE[m.primary_class_cd!];
      const difficulty = DIFFICULTY_BY_CODE[(m.difficulty ?? "").toUpperCase()];
      if (!difficulty) throw new Error(`unknown difficulty "${m.difficulty}"`);
      const skill = mapSkill(m.skill_desc ?? "", domain);
      if (!skill) {
        const key = `${domain} / ${m.skill_desc}`;
        unmappedSkills.set(key, (unmappedSkills.get(key) ?? 0) + 1);
        throw new Error(`unmapped skill "${m.skill_desc}"`);
      }

      const item = normalizeItem(await fetchItem(m));
      if (item.correct.length === 0) throw new Error("no correct answer in item");
      if (item.type === "MCQ" && item.options.length !== 4)
        throw new Error(`MCQ with ${item.options.length} options`);

      const base = `cbqb-${qid}`;
      const figs: Figure[] = [];
      const conv = (html: string, part: string) => {
        const c = htmlToMarkdown(html, `${base}-${part}`);
        figs.push(...c.figures);
        for (const url of remoteImages(c.markdown)) remote.push({ id: qid, url });
        return c.markdown;
      };

      const stem = [conv(item.stimulus, "stim"), conv(item.stem, "stem")].filter(Boolean).join("\n\n");
      if (!stem) throw new Error("empty stem");
      const missing = missingContext(stem);
      if (missing) throw new Error(`unanswerable as converted: ${missing}`);

      const row: OutRow = {
        externalId: `cbqb:${qid}`,
        domain,
        skill: skill.code,
        difficulty,
        type: item.type,
        stem,
        answer: item.type === "MCQ" ? item.correct[0] : item.correct,
        explanation: conv(item.rationale, "expl") || undefined,
      };
      if (item.type === "MCQ")
        row.choices = Object.fromEntries(item.options.map((html, i) => ["ABCD"[i], conv(html, `ch${"abcd"[i]}`)]));

      for (const f of figs) writeFileSync(join(FIGURES, f.name), f.data);
      figureCount += figs.length;
      rows.push(row);
    } catch (e) {
      failures.push({ id: qid, error: (e as Error).message });
    }
    if (++done % 50 === 0 || done === metas.length) console.log(`  ${done}/${metas.length}`);
  });

  rows.sort((a, b) => a.externalId.localeCompare(b.externalId));
  writeFileSync(join(OUT, "questions.json"), JSON.stringify(rows, null, 2));

  const byDomain = Object.fromEntries(
    Object.values(DOMAIN_BY_CODE).map((d) => [d, rows.filter((r) => r.domain === d).length]),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    listed: list.length,
    converted: rows.length,
    figures: figureCount,
    byDomain,
    byType: { MCQ: rows.filter((r) => r.type === "MCQ").length, SPR: rows.filter((r) => r.type === "SPR").length },
    unmappedSkills: Object.fromEntries(unmappedSkills),
    remoteImages: remote,
    failures,
  };
  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));

  console.log(`\nConverted ${rows.length}, failed ${failures.length}, figures ${figureCount}`);
  console.log(`  by domain: ${JSON.stringify(byDomain)}`);
  if (unmappedSkills.size) console.log(`  unmapped skills: ${[...unmappedSkills.keys()].join("; ")}`);
  if (remote.length) console.log(`  ${remote.length} remote images left as URLs (see report.json)`);
  if (failures.length) console.log(`  first failures:`, failures.slice(0, 5));
  console.log(`\nWrote ${join(OUT, "questions.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
