import type { Prisma } from "@/generated/prisma/client";

/** Question-bank filters, as they appear in the URL (?domain=…&status=inactive…). */
export type QuestionFilters = {
  domain?: string;
  skillId?: string;
  difficulty?: string;
  type?: string;
  q?: string;
  status?: string;
  source?: string;
};

export const FILTER_KEYS = ["domain", "skillId", "difficulty", "type", "q", "status", "source"] as const;

/** Where a question came from, derived from its externalId prefix ("cbqb:…", "openstax:…", "sample-…"). */
export const SOURCE_LABEL: Record<string, string> = {
  cbqb: "College Board question bank",
  openstax: "OpenStax",
  agieval: "AGIEval (official SAT)",
  sample: "Samples",
  none: "Created here / no source",
};

export function questionWhere(f: QuestionFilters): Prisma.QuestionWhereInput {
  const src = f.source;
  return {
    ...(f.status === "inactive"
      ? { active: false }
      : f.status === "flagged"
        ? { reviewNote: { not: null } }
        : f.status === "all"
          ? {}
          : { active: true }),
    ...(f.domain && { domain: f.domain as never }),
    ...(f.skillId && { skillId: Number(f.skillId) }),
    ...(f.difficulty && { difficulty: f.difficulty as never }),
    ...(f.type && { type: f.type as never }),
    ...(f.q && { stem: { contains: f.q, mode: "insensitive" as const } }),
    ...(src === "none"
      ? { externalId: null }
      : src && /^[a-z]+$/.test(src)
        ? { OR: [{ externalId: { startsWith: `${src}:` } }, { externalId: { startsWith: `${src}-` } }] }
        : {}),
  };
}

/** Keeps only known filter keys with values (for links that carry the current filter). */
export function cleanFilters(sp: Record<string, string | undefined>): QuestionFilters {
  return Object.fromEntries(FILTER_KEYS.filter((k) => sp[k]).map((k) => [k, sp[k]])) as QuestionFilters;
}

export const filterQuery = (f: QuestionFilters, extra: Record<string, string> = {}) =>
  new URLSearchParams({ ...(f as Record<string, string>), ...extra }).toString();
