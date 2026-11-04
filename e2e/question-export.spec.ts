import { expect, test } from "@playwright/test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { newStudent, sql, staffPage, uid } from "./helpers";

// 1x1 PNG
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("export questions with figures and status, import them on a fresh site", async ({ browser }) => {
  const batch = uid();
  const [{ id: skillId }] = await sql<{ id: number }>(`SELECT id FROM "Skill" WHERE code = 'CIRCLES'`);
  const [{ id: assetId }] = await sql<{ id: string }>(
    `INSERT INTO "Asset" (id, "mimeType", filename, data) VALUES ($1, 'image/png', 'circle.png', $2) RETURNING id`,
    [`asset${batch}`, PNG],
  );
  const insert = (id: string, ext: string | null, active: boolean, stem: string) =>
    sql(
      `INSERT INTO "Question" (id, "externalId", domain, "skillId", difficulty, type, stem, "sprAnswers", active, "updatedAt")
       VALUES ($1, $2, 'GEOMETRY_TRIGONOMETRY', $3, 'HARD', 'SPR', $4, ARRAY['12'], $5, now())`,
      [id, ext, skillId, stem, active],
    );
  await insert(`exa${batch}`, `exptest:${batch}-a`, true, `Export ${batch} A ![circle](/api/assets/${assetId}) radius?`);
  await insert(`exb${batch}`, `exptest:${batch}-b`, false, `Export ${batch} B (inactive)`);
  await insert(`exc${batch}`, null, true, `Export ${batch} C (made here, no source id)`);

  const staff = await staffPage(browser);
  // Students can't export.
  const student = await newStudent(browser);
  expect((await student.page.request.get(`/api/questions/export?status=all&q=${batch}`)).status()).toBe(403);

  // The list's Export button downloads the current filter.
  await staff.goto(`/staff/questions?status=all&q=${batch}`);
  const [download] = await Promise.all([staff.waitForEvent("download"), staff.getByRole("link", { name: "Export these" }).click()]);
  const file = path.join(mkdtempSync(path.join(tmpdir(), "export-")), download.suggestedFilename());
  await download.saveAs(file);
  const rows = JSON.parse(readFileSync(file, "utf8")) as { externalId: string; stem: string; active: boolean; skill: string }[];
  expect(rows).toHaveLength(3);
  const a = rows.find((r) => r.externalId === `exptest:${batch}-a`)!;
  expect(a.stem).toContain("](data:image/png;base64,");
  expect(a.skill).toBe("CIRCLES");
  expect(rows.find((r) => r.externalId === `exptest:${batch}-b`)!.active).toBe(false);
  expect(rows.some((r) => r.externalId === `local:exc${batch}`)).toBe(true);

  // "Fresh site": the questions and the figure are gone.
  await sql(`DELETE FROM "Question" WHERE stem LIKE $1`, [`Export ${batch}%`]);
  await sql(`DELETE FROM "Asset" WHERE id = $1`, [assetId]);

  await staff.goto("/staff/questions/import");
  await staff.locator("input[name=file]").setInputFiles(file);
  await staff.getByRole("button", { name: "Import" }).click();
  await expect(staff.getByText(/3 rows read · 3 imported · 0 updated · 0 already there/)).toBeVisible();
  await expect(staff.getByText(/1 figures stored/)).toBeVisible();

  const back = await sql<{ externalId: string; active: boolean; stem: string }>(
    `SELECT "externalId", active, stem FROM "Question" WHERE stem LIKE $1 ORDER BY "externalId"`,
    [`Export ${batch}%`],
  );
  expect(back.map((q) => [q.externalId, q.active])).toEqual([
    [`exptest:${batch}-a`, true],
    [`exptest:${batch}-b`, false],
    [`local:exc${batch}`, true],
  ]);
  const newAsset = /\/api\/assets\/([a-z0-9]+)/.exec(back[0].stem)![1];
  const [stored] = await sql<{ data: Buffer }>(`SELECT data FROM "Asset" WHERE id = $1`, [newAsset]);
  expect(Buffer.compare(stored.data, PNG)).toBe(0);

  // Importing again skips; with "update", changed rows (here: status) are applied.
  rows.find((r) => r.externalId === `exptest:${batch}-b`)!.active = true;
  writeFileSync(file, JSON.stringify(rows));
  await staff.reload();
  await staff.locator("input[name=file]").setInputFiles(file);
  await staff.getByRole("button", { name: "Import" }).click();
  await expect(staff.getByText(/3 rows read · 0 imported · 0 updated · 3 already there/)).toBeVisible();
  await staff.getByLabel(/Update questions that already exist/).check();
  await staff.getByRole("button", { name: "Import" }).click();
  await expect(staff.getByText(/3 rows read · 0 imported · 1 updated · 2 already there/)).toBeVisible();
  const [{ active }] = await sql<{ active: boolean }>(`SELECT active FROM "Question" WHERE "externalId" = $1`, [`exptest:${batch}-b`]);
  expect(active).toBe(true);

  await sql(`DELETE FROM "Question" WHERE stem LIKE $1`, [`Export ${batch}%`]);
});
