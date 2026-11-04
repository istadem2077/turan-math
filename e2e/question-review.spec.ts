import { expect, test } from "@playwright/test";
import { sql, staffPage, uid } from "./helpers";

/** Inserts inactive SPR questions with externalId "revtest:<batch>-<n>" (source filter "revtest"). */
async function seed(n: number) {
  const batch = uid();
  const [{ id: skillId }] = await sql<{ id: number }>(`SELECT id FROM "Skill" WHERE code = 'LIN_EQ_1VAR'`);
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = `rev${batch}${String(i).padStart(3, "0")}`;
    ids.push(id);
    await sql(
      `INSERT INTO "Question" (id, "externalId", domain, "skillId", difficulty, type, stem, "sprAnswers", active, "updatedAt")
       VALUES ($1, $2, 'ALGEBRA', $3, 'EASY', 'SPR', $4, ARRAY['5'], false, now())`,
      [id, `revtest:${batch}-${i}`, skillId, `Review test ${batch} #${i}: solve $x + ${i} = ${i + 5}$.`],
    );
  }
  return { batch, ids };
}

test.afterAll(async () => {
  await sql(`DELETE FROM "Question" WHERE "externalId" LIKE 'revtest:%'`);
});

test("review mode: keyboard shortcuts activate, skip and delete, saving difficulty edits", async ({ browser }) => {
  const { batch, ids } = await seed(3);
  const staff = await staffPage(browser);
  await staff.goto(`/staff/questions?status=inactive&source=revtest&q=${batch}`);
  await staff.getByRole("link", { name: "Review these" }).click();
  await expect(staff.getByText(`#0:`)).toBeVisible();
  await expect(staff.getByText("Accepted answer: 5")).toBeVisible();

  await staff.keyboard.press("2"); // medium
  await staff.keyboard.press("a"); // activate
  await expect(staff.getByText(`#1:`)).toBeVisible();
  await staff.keyboard.press("s"); // skip
  await expect(staff.getByText(`#2:`)).toBeVisible();
  staff.once("dialog", (d) => d.accept());
  await staff.keyboard.press("d"); // delete
  await expect(staff.getByText("Nothing left to review here.")).toBeVisible();

  const rows = await sql<{ id: string; active: boolean; difficulty: string }>(`SELECT id, active, difficulty FROM "Question" WHERE id = ANY($1) ORDER BY id`, [ids]);
  expect(rows).toEqual([
    { id: ids[0], active: true, difficulty: "MEDIUM" },
    { id: ids[1], active: false, difficulty: "EASY" },
  ]);
});

test("bulk actions: selected rows, and everything matching the filter", async ({ browser }) => {
  const { batch, ids } = await seed(35);
  const staff = await staffPage(browser);
  await staff.goto(`/staff/questions?status=inactive&source=revtest&q=${batch}`);
  await expect(staff.getByText("35 questions · page 1 of 2")).toBeVisible();

  // Two rows → activate.
  await staff.getByRole("checkbox", { name: "Select question" }).nth(0).check();
  await staff.getByRole("checkbox", { name: "Select question" }).nth(1).check();
  staff.once("dialog", (d) => d.accept());
  await staff.getByRole("button", { name: "Activate", exact: true }).click();
  await expect(staff.getByText("Activated 2 questions.")).toBeVisible();

  // Everything still matching (33, across two pages) → delete.
  await staff.reload();
  await staff.getByRole("checkbox", { name: "Select all on this page" }).check();
  await staff.getByRole("button", { name: "Select all 33 matching" }).click();
  await expect(staff.getByText("33 selected (everything matching the filter)")).toBeVisible();
  staff.once("dialog", (d) => d.accept());
  await staff.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(staff.getByText("Deleted 33 questions.")).toBeVisible();

  const [{ left, active }] = await sql<{ left: number; active: number }>(
    `SELECT count(*)::int AS left, count(*) FILTER (WHERE active)::int AS active FROM "Question" WHERE id = ANY($1)`,
    [ids],
  );
  expect({ left, active }).toEqual({ left: 2, active: 2 });
});
