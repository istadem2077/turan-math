import { expect, test } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql, staffPage, uid } from "./helpers";

test("unsolvable questions: skipped by default, or imported flagged for review", async ({ browser }) => {
  const b = uid();
  const file = path.join(mkdtempSync(path.join(tmpdir(), "uns-")), "questions.json");
  writeFileSync(
    file,
    JSON.stringify([
      { externalId: `unstest:${b}-ok`, domain: "ALGEBRA", skill: "LIN_EQ_1VAR", difficulty: "EASY", type: "SPR", stem: `Unsolvable test ${b}: if $x+2=5$, what is $x$?`, answer: ["3"], active: true },
      { externalId: `unstest:${b}-bad`, domain: "ADVANCED_MATH", skill: "NONLIN_FUNC", difficulty: "MEDIUM", type: "SPR", stem: `Unsolvable test ${b}: for the function f defined above, what is $f(2)$?`, answer: ["7"], active: false, unsolvable: 'says "above" but nothing precedes it' },
    ]),
  );
  const staff = await staffPage(browser);

  // Default: only the solvable one.
  await staff.goto("/staff/questions/import");
  await staff.locator("input[name=file]").setInputFiles(file);
  await staff.getByRole("button", { name: "Import" }).click();
  await expect(staff.getByText(/1 imported .* 1 unsolvable skipped/)).toBeVisible();

  // Including unsolvable: it comes in inactive and flagged.
  await staff.getByLabel(/Also import questions marked unsolvable/).check();
  await staff.getByRole("button", { name: "Import" }).click();
  await expect(staff.getByText(/1 imported · 0 updated · 1 already there/)).toBeVisible();
  const rows = await sql<{ externalId: string; active: boolean; reviewNote: string | null }>(
    `SELECT "externalId", active, "reviewNote" FROM "Question" WHERE "externalId" LIKE $1 ORDER BY 1`,
    [`unstest:${b}%`],
  );
  expect(rows).toEqual([
    { externalId: `unstest:${b}-bad`, active: false, reviewNote: 'says "above" but nothing precedes it' },
    { externalId: `unstest:${b}-ok`, active: true, reviewNote: null },
  ]);

  // Status: Flagged → review mode shows the reason; activating clears it.
  await staff.goto(`/staff/questions?status=flagged&q=${b}`);
  await expect(staff.getByText("1 questions · page 1 of 1")).toBeVisible();
  await staff.getByRole("link", { name: "Review these" }).click();
  await expect(staff.getByText(/Flagged as unsolvable:/)).toBeVisible();
  await expect(staff.getByText(/nothing precedes it/)).toBeVisible();
  await staff.keyboard.press("a");
  await expect(staff.getByText("Nothing left to review here.")).toBeVisible();
  const [after] = await sql<{ active: boolean; reviewNote: string | null }>(`SELECT active, "reviewNote" FROM "Question" WHERE "externalId" = $1`, [`unstest:${b}-bad`]);
  expect(after).toEqual({ active: true, reviewNote: null });

  await sql(`DELETE FROM "Question" WHERE "externalId" LIKE $1`, [`unstest:${b}%`]);
});
