import { describe, expect, it } from "vitest";
import { markSolvability, type OutRow } from "./common";

const row = (stem: string, extra: Partial<OutRow> = {}): OutRow => ({
  externalId: "t", domain: "ALGEBRA", skill: "LIN_EQ_1VAR", difficulty: "EASY", type: "SPR", stem, answer: ["1"], ...extra,
});

describe("markSolvability", () => {
  it("activates solvable questions", () => {
    const rows = [row("If $3x+5=20$, what is $x$?")];
    markSolvability(rows);
    expect(rows[0]).toMatchObject({ active: true, unsolvable: undefined });
  });
  it("marks missing definitions, figures and broken math", () => {
    const rows = [row("For the function f defined above, what is $f(1)$?"), row("In the figure, what is $x$?"), row("Solve $x+1=2")];
    markSolvability(rows);
    expect(rows.map((r) => [r.active, r.unsolvable])).toEqual([
      [false, 'says "above" but nothing precedes it'],
      [false, "mentions a figure that isn't included"],
      [false, "broken math"],
    ]);
  });
  it("keeps the scraper's reason and doesn't repeat it", () => {
    const rows = [row("Based on the table, what is $x$?", { unsolvable: "needs a figure or table that isn't in the data" })];
    markSolvability(rows);
    expect(rows[0].unsolvable).toBe("needs a figure or table that isn't in the data");
  });
});
