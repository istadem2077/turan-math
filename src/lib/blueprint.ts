/**
 * Bluebook (digital SAT) Math blueprint.
 *
 * Real digital SAT Math: 2 modules x 22 questions (20 operational + 2 pretest).
 * Content share across the section: Algebra ~35%, Advanced Math ~35%,
 * Problem-Solving & Data Analysis ~15%, Geometry & Trigonometry ~15%.
 * Roughly a quarter of questions are student-produced responses (SPR).
 * Within a module the questions are arranged from easier to harder, with
 * content domains mixed throughout.
 *
 * Per-module counts below give section totals of 15 / 15 / 7 / 7 = 44.
 * Difficulty is not adaptive (both modules use the same mix).
 */
import type { Difficulty, Domain, QuestionType } from "@/generated/prisma/enums";

export const QUESTIONS_PER_MODULE = 22;
export const MODULE_COUNT = 2;
export const DEFAULT_MODULE_MINUTES = 27;

export type ModuleSpec = {
  domains: Record<Domain, number>;
  difficulty: Record<Difficulty, number>;
  spr: number;
};

export const BLUEPRINT: [ModuleSpec, ModuleSpec] = [
  {
    domains: { ALGEBRA: 8, ADVANCED_MATH: 7, PROBLEM_SOLVING_DATA_ANALYSIS: 4, GEOMETRY_TRIGONOMETRY: 3 },
    difficulty: { EASY: 7, MEDIUM: 8, HARD: 7 },
    spr: 6,
  },
  {
    domains: { ALGEBRA: 7, ADVANCED_MATH: 8, PROBLEM_SOLVING_DATA_ANALYSIS: 3, GEOMETRY_TRIGONOMETRY: 4 },
    difficulty: { EASY: 7, MEDIUM: 8, HARD: 7 },
    spr: 6,
  },
];

export type Slot = { domain: Domain; difficulty: Difficulty; type: QuestionType };

export type Rng = () => number;

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function expand<K extends string>(counts: Record<K, number>): K[] {
  return (Object.entries(counts) as [K, number][]).flatMap(([k, n]) => Array<K>(n).fill(k));
}

const DIFF_ORDER: Record<Difficulty, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };

/**
 * Turns a module spec into 22 ordered slots: difficulty ascending, domains
 * randomly interleaved, SPR positions spread randomly. Marginal counts are
 * exact.
 */
export function planModule(spec: ModuleSpec, rng: Rng = Math.random): Slot[] {
  const domains = shuffle(expand(spec.domains), rng);
  const difficulties = expand(spec.difficulty).sort((a, b) => DIFF_ORDER[a] - DIFF_ORDER[b]);
  if (domains.length !== QUESTIONS_PER_MODULE || difficulties.length !== QUESTIONS_PER_MODULE) {
    throw new Error("Blueprint counts must add up to the module length");
  }
  const sprIdx = new Set(shuffle([...Array(QUESTIONS_PER_MODULE).keys()], rng).slice(0, spec.spr));
  return difficulties.map((difficulty, i) => ({
    domain: domains[i],
    difficulty,
    type: sprIdx.has(i) ? "SPR" : "MCQ",
  }));
}

export type Candidate = { id: string; skillId: number };
export type CandidateFilter = { domain: Domain; difficulty?: Difficulty; type?: QuestionType };
export type FetchCandidates = (
  filter: CandidateFilter,
  excludeIds: string[],
  limit: number,
) => Promise<Candidate[]>;

const ADJACENT: Record<Difficulty, Difficulty[]> = {
  EASY: ["MEDIUM", "HARD"],
  MEDIUM: ["EASY", "HARD"],
  HARD: ["MEDIUM", "EASY"],
};

/**
 * Fills the slots with questions. Within a group of identical slots it
 * prefers skills not yet used in the module. When the bank lacks questions
 * for an exact slot, it relaxes the question type, then the difficulty, while
 * always keeping the domain.
 */
export async function fillModule(
  slots: Slot[],
  fetchCandidates: FetchCandidates,
  used: Set<string>,
): Promise<string[]> {
  const result: (string | null)[] = Array(slots.length).fill(null);
  const skillCount = new Map<number, number>();

  const groups = new Map<string, number[]>();
  slots.forEach((s, i) => {
    const key = `${s.domain}|${s.difficulty}|${s.type}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  });

  for (const idxs of groups.values()) {
    const slot = slots[idxs[0]];
    const otherType: QuestionType = slot.type === "MCQ" ? "SPR" : "MCQ";
    const filters: CandidateFilter[] = [
      { domain: slot.domain, difficulty: slot.difficulty, type: slot.type },
      { domain: slot.domain, difficulty: slot.difficulty, type: otherType },
      ...ADJACENT[slot.difficulty].map((d) => ({ domain: slot.domain, difficulty: d, type: slot.type })),
      ...ADJACENT[slot.difficulty].map((d) => ({ domain: slot.domain, difficulty: d, type: otherType })),
    ];

    let remaining = [...idxs];
    for (const filter of filters) {
      if (remaining.length === 0) break;
      const pool = await fetchCandidates(filter, [...used], remaining.length * 6);
      while (remaining.length && pool.length) {
        // Pick the candidate whose skill has appeared least in this module.
        let best = 0;
        for (let j = 1; j < pool.length; j++) {
          if ((skillCount.get(pool[j].skillId) ?? 0) < (skillCount.get(pool[best].skillId) ?? 0)) best = j;
        }
        const [c] = pool.splice(best, 1);
        if (used.has(c.id)) continue;
        used.add(c.id);
        skillCount.set(c.skillId, (skillCount.get(c.skillId) ?? 0) + 1);
        result[remaining.shift()!] = c.id;
      }
    }
    if (remaining.length) {
      throw new Error(
        `Not enough active questions in the bank for domain ${slot.domain}. Add more questions or build the test manually.`,
      );
    }
  }
  return result as string[];
}
