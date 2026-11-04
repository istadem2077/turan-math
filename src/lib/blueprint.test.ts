import { describe, expect, it } from "vitest";
import { BLUEPRINT, fillModule, planModule, type Candidate, type CandidateFilter } from "./blueprint";
import { DOMAINS } from "./taxonomy";

const ORDER = { EASY: 0, MEDIUM: 1, HARD: 2 };

describe("planModule", () => {
  for (const [m, spec] of BLUEPRINT.entries()) {
    it(`module ${m + 1} matches the blueprint exactly`, () => {
      for (let run = 0; run < 50; run++) {
        const slots = planModule(spec);
        expect(slots).toHaveLength(22);
        for (const d of DOMAINS) expect(slots.filter((s) => s.domain === d)).toHaveLength(spec.domains[d]);
        expect(slots.filter((s) => s.type === "SPR")).toHaveLength(spec.spr);
        for (let i = 1; i < slots.length; i++) expect(ORDER[slots[i].difficulty]).toBeGreaterThanOrEqual(ORDER[slots[i - 1].difficulty]);
      }
    });
  }
  it("section totals are 15/15/7/7", () => {
    const total = (d: (typeof DOMAINS)[number]) => BLUEPRINT[0].domains[d] + BLUEPRINT[1].domains[d];
    expect(DOMAINS.map(total)).toEqual([15, 15, 7, 7]);
  });
});

type Q = Candidate & CandidateFilter & { difficulty: string; type: string };

function bank(qs: Q[]) {
  return async (f: CandidateFilter, exclude: string[], limit: number) =>
    qs
      .filter((q) => q.domain === f.domain && (!f.difficulty || q.difficulty === f.difficulty) && (!f.type || q.type === f.type) && !exclude.includes(q.id))
      .sort(() => Math.random() - 0.5)
      .slice(0, limit);
}

function fullBank(perCell = 10): Q[] {
  const qs: Q[] = [];
  let n = 0;
  for (const domain of DOMAINS)
    for (const difficulty of ["EASY", "MEDIUM", "HARD"] as const)
      for (const type of ["MCQ", "SPR"] as const)
        for (let i = 0; i < perCell; i++) qs.push({ id: `q${n++}`, skillId: (i % 3) + DOMAINS.indexOf(domain) * 10, domain, difficulty, type });
  return qs;
}

describe("fillModule", () => {
  it("fills every slot with a unique matching question", async () => {
    const qs = fullBank();
    const byId = new Map(qs.map((q) => [q.id, q]));
    const used = new Set<string>();
    for (const spec of BLUEPRINT) {
      const slots = planModule(spec);
      const ids = await fillModule(slots, bank(qs), used);
      ids.forEach((id, i) => {
        const q = byId.get(id)!;
        expect(q.domain).toBe(slots[i].domain);
        expect(q.difficulty).toBe(slots[i].difficulty);
        expect(q.type).toBe(slots[i].type);
      });
    }
    expect(used.size).toBe(44);
  });

  it("spreads skills within a group", async () => {
    const qs = fullBank(30);
    const byId = new Map(qs.map((q) => [q.id, q]));
    const slots = Array(3).fill({ domain: "ALGEBRA", difficulty: "EASY", type: "MCQ" });
    const ids = await fillModule(slots, bank(qs), new Set());
    expect(new Set(ids.map((id) => byId.get(id)!.skillId)).size).toBe(3);
  });

  it("falls back to another type/difficulty in the same domain", async () => {
    const qs = fullBank(10).filter((q) => q.type === "MCQ" && q.difficulty === "MEDIUM");
    const ids = await fillModule(planModule(BLUEPRINT[0]), bank(qs), new Set());
    expect(new Set(ids).size).toBe(22);
  });

  it("errors when a domain runs dry", async () => {
    const qs = fullBank(1).filter((q) => q.domain !== "GEOMETRY_TRIGONOMETRY");
    await expect(fillModule(planModule(BLUEPRINT[0]), bank(qs), new Set())).rejects.toThrow(/GEOMETRY_TRIGONOMETRY/);
  });
});
