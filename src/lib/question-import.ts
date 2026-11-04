/**
 * Bulk question import (JSON or CSV). See docs/question-import.md for the format.
 */
import Papa from "papaparse";
import { z } from "zod";
import { MCQ_KEYS } from "./taxonomy";

const DOMAIN_ALIASES: Record<string, string> = {
  ALGEBRA: "ALGEBRA",
  "ADVANCED MATH": "ADVANCED_MATH",
  ADVANCED_MATH: "ADVANCED_MATH",
  PSDA: "PROBLEM_SOLVING_DATA_ANALYSIS",
  "PROBLEM-SOLVING AND DATA ANALYSIS": "PROBLEM_SOLVING_DATA_ANALYSIS",
  "PROBLEM SOLVING AND DATA ANALYSIS": "PROBLEM_SOLVING_DATA_ANALYSIS",
  PROBLEM_SOLVING_DATA_ANALYSIS: "PROBLEM_SOLVING_DATA_ANALYSIS",
  "GEOMETRY AND TRIGONOMETRY": "GEOMETRY_TRIGONOMETRY",
  GEOMETRY_TRIGONOMETRY: "GEOMETRY_TRIGONOMETRY",
  GEOMETRY: "GEOMETRY_TRIGONOMETRY",
};
const DIFF_ALIASES: Record<string, string> = { E: "EASY", M: "MEDIUM", H: "HARD", EASY: "EASY", MEDIUM: "MEDIUM", HARD: "HARD" };

const up = (v: unknown) => String(v ?? "").trim().toUpperCase();

export const ImportRow = z
  .object({
    externalId: z.string().trim().min(1).optional(),
    domain: z.preprocess((v) => DOMAIN_ALIASES[up(v)] ?? v, z.enum(["ALGEBRA", "ADVANCED_MATH", "PROBLEM_SOLVING_DATA_ANALYSIS", "GEOMETRY_TRIGONOMETRY"])),
    skill: z.string().trim().min(1),
    difficulty: z.preprocess((v) => DIFF_ALIASES[up(v)] ?? v, z.enum(["EASY", "MEDIUM", "HARD"])),
    type: z.preprocess((v) => (up(v) === "GRID-IN" || up(v) === "GRID" ? "SPR" : up(v)), z.enum(["MCQ", "SPR"])),
    stem: z.string().trim().min(1),
    choices: z.record(z.string(), z.string()).optional(),
    answer: z.union([z.string(), z.array(z.string())]),
    explanation: z.string().optional(),
    /** false = imported as inactive (not drawn into tests until a staff member activates it). Default true. */
    active: z.preprocess((v) => (typeof v === "string" ? !/^(false|0|no)$/i.test(v.trim()) : v), z.boolean()).optional(),
  })
  .superRefine((r, ctx) => {
    if (r.type === "MCQ") {
      const keys = Object.keys(r.choices ?? {}).map((k) => k.toUpperCase());
      if (keys.length !== 4 || !MCQ_KEYS.every((k) => keys.includes(k)))
        ctx.addIssue({ code: "custom", message: "MCQ needs choices A, B, C and D" });
      const ans = Array.isArray(r.answer) ? r.answer[0] : r.answer;
      if (!MCQ_KEYS.includes(up(ans) as never)) ctx.addIssue({ code: "custom", message: "MCQ answer must be A, B, C or D" });
    } else {
      const answers = Array.isArray(r.answer) ? r.answer : r.answer.split("|");
      if (!answers.some((a) => a.trim())) ctx.addIssue({ code: "custom", message: "SPR needs at least one accepted answer" });
    }
  });
export type ImportRow = z.infer<typeof ImportRow>;

/** CSV columns: externalId, domain, skill, difficulty, type, stem, choiceA..choiceD, answer, explanation, active (optional) */
function csvToObjects(text: string): Record<string, unknown>[] {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  return parsed.data.map((r) => {
    const choices = r.choiceA || r.choiceB ? { A: r.choiceA, B: r.choiceB, C: r.choiceC, D: r.choiceD } : undefined;
    return {
      externalId: r.externalId || undefined,
      domain: r.domain,
      skill: r.skill,
      difficulty: r.difficulty,
      type: r.type,
      stem: r.stem,
      choices,
      answer: r.answer ?? "",
      explanation: r.explanation || undefined,
      active: r.active || undefined,
    };
  });
}

export function parseImportFile(filename: string, text: string): unknown[] {
  if (filename.toLowerCase().endsWith(".csv")) return csvToObjects(text);
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("JSON file must contain an array of questions");
  return data;
}

export type SkillLookup = { id: number; code: string; name: string; domain: string }[];

export function toQuestionData(rows: unknown[], skills: SkillLookup) {
  const byKey = new Map<string, SkillLookup[number]>();
  for (const s of skills) {
    byKey.set(s.code.toUpperCase(), s);
    byKey.set(s.name.toUpperCase(), s);
  }
  const ok = [];
  const errors: { row: number; message: string }[] = [];
  for (const [i, raw] of rows.entries()) {
    const parsed = ImportRow.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: i + 1, message: parsed.error.issues.map((x) => `${x.path.join(".") || "row"}: ${x.message}`).join("; ") });
      continue;
    }
    const r = parsed.data;
    const skill = byKey.get(r.skill.toUpperCase());
    if (!skill) {
      errors.push({ row: i + 1, message: `Unknown skill "${r.skill}"` });
      continue;
    }
    if (skill.domain !== r.domain) {
      errors.push({ row: i + 1, message: `Skill "${skill.name}" belongs to ${skill.domain}, not ${r.domain}` });
      continue;
    }
    const common = {
      externalId: r.externalId,
      domain: r.domain,
      skillId: skill.id,
      difficulty: r.difficulty,
      type: r.type,
      stem: r.stem,
      explanation: r.explanation,
      active: r.active ?? true,
    };
    if (r.type === "MCQ") {
      const c = Object.fromEntries(Object.entries(r.choices!).map(([k, v]) => [k.toUpperCase(), v]));
      ok.push({
        ...common,
        choices: MCQ_KEYS.map((key) => ({ key, text: c[key] })),
        correctChoice: up(Array.isArray(r.answer) ? r.answer[0] : r.answer),
        sprAnswers: [],
      });
    } else {
      const answers = (Array.isArray(r.answer) ? r.answer : r.answer.split("|")).map((a) => a.trim()).filter(Boolean);
      ok.push({ ...common, sprAnswers: answers });
    }
  }
  return { ok, errors };
}
