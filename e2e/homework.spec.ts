import { expect, test } from "@playwright/test";
import path from "node:path";
import { addToRoom, createRoom, idFromUrl, localDateTime, newStudent, sql, staffPage } from "./helpers";

const PDF = path.resolve("e2e/fixtures/homework.pdf");
const TXT = path.resolve("e2e/fixtures/notes.txt");

test("homework: assign, hand in, grade with a response, reopen", async ({ browser }) => {
  const staff = await staffPage(browser);
  const room = await createRoom(staff);
  const carol = await newStudent(browser, "Carol");
  const outsider = await newStudent(browser, "Outsider");
  await addToRoom(room.id, carol.id);

  // Assign: PDF only, with a worksheet attached.
  await staff.goto(`/staff/rooms/${room.id}/homework/new`);
  await staff.getByLabel("Title").fill("HW 1");
  await staff.locator("textarea[name=instructions]").fill("Solve $x^2 = 4$.");
  await staff.locator("input[type=datetime-local]").fill(localDateTime(24 * 3600_000));
  for (const box of await staff.locator("input[name=formats]").all()) await box.uncheck();
  await staff.locator("input[name=formats][value=pdf]").check();
  await staff.locator("input[name=attachments]").setInputFiles(PDF);
  await staff.getByRole("button", { name: "Assign homework" }).click();
  const hwId = await idFromUrl(staff, /\/homework\/[a-z0-9]+$/);
  await expect(staff.getByText("Submissions (0/1)")).toBeVisible();

  // Student sees it on their home page.
  await carol.page.goto("/student");
  await carol.page.getByRole("link", { name: /HW 1/ }).click();
  await expect(carol.page.locator(".katex").first()).toBeVisible(); // math rendered

  // Attachment: the room's student can download it, others can't.
  const [att] = await sql<{ id: string }>(`SELECT id FROM "StoredFile" WHERE "homeworkId" = $1`, [hwId]);
  expect((await carol.page.request.get(`/api/files/${att.id}`)).status()).toBe(200);
  expect((await outsider.page.request.get(`/api/files/${att.id}`)).status()).toBe(404);
  expect((await outsider.page.goto(`/student/rooms/${room.id}/homework/${hwId}`))?.status()).toBe(404);

  // Wrong format is rejected by the server.
  await carol.page.locator("input[name=files]").setInputFiles(TXT);
  await carol.page.getByRole("button", { name: "Hand in" }).click();
  await expect(carol.page.getByText(/isn't an accepted format/).last()).toBeVisible();

  await carol.page.locator("input[name=files]").setInputFiles(PDF);
  await carol.page.locator("textarea[name=note]").fill("My work");
  await carol.page.getByRole("button", { name: "Hand in" }).click();
  await expect(carol.page.getByText("Submitted.")).toBeVisible();

  // Other students can't download Carol's file.
  const [own] = await sql<{ id: string }>(
    `SELECT f.id FROM "StoredFile" f JOIN "HomeworkSubmission" s ON s.id = f."submissionId" WHERE s."homeworkId" = $1`,
    [hwId],
  );
  expect((await outsider.page.request.get(`/api/files/${own.id}`)).status()).toBe(404);

  // Grade with a response and a file.
  await staff.reload();
  await expect(staff.getByText("To grade")).toBeVisible();
  await staff.getByRole("link", { name: /Grade/ }).click();
  await expect(staff.getByText("My work")).toBeVisible();
  await staff.getByLabel(/Score/).fill("87");
  await staff.locator("textarea[name=feedback]").fill("Good, but don't forget $x = -2$.");
  await staff.locator("input[name=feedbackFiles]").setInputFiles(PDF);
  await staff.getByRole("button", { name: "Save grade & response" }).click();
  await expect(staff.getByText(/student can now see your grade/)).toBeVisible();

  // Student sees the grade and response; hand-in is locked.
  await carol.page.reload();
  await expect(carol.page.getByText("Graded · 87/100")).toBeVisible();
  await expect(carol.page.getByText(/don't forget/)).toBeVisible();
  await expect(carol.page.locator("input[name=files]")).toHaveCount(0);

  // Reopen: the student can hand in again.
  staff.once("dialog", (d) => d.accept());
  await staff.getByRole("button", { name: "Reopen for resubmission" }).click();
  await expect(staff.getByRole("button", { name: "Save grade & response" })).toBeVisible();
  await carol.page.reload();
  await expect(carol.page.getByText(/reopened this homework/)).toBeVisible();
  await expect(carol.page.locator("input[name=files]")).toHaveCount(1);
});

test("homework without late hand-ins closes at the due date", async ({ browser }) => {
  const staff = await staffPage(browser);
  const room = await createRoom(staff);
  const dan = await newStudent(browser, "Dan");
  await addToRoom(room.id, dan.id);

  await staff.goto(`/staff/rooms/${room.id}/homework/new`);
  await staff.getByLabel("Title").fill("Past due");
  await staff.locator("input[type=datetime-local]").fill(localDateTime(24 * 3600_000));
  await staff.getByRole("button", { name: "Assign homework" }).click();
  const hwId = await idFromUrl(staff, /\/homework\/[a-z0-9]+$/);
  await sql(`UPDATE "Homework" SET "dueAt" = now() - interval '1 hour' WHERE id = $1`, [hwId]);

  await dan.page.goto(`/student/rooms/${room.id}/homework/${hwId}`);
  await expect(dan.page.getByText(/no longer accepts hand-ins/)).toBeVisible();
  await expect(dan.page.locator("input[name=files]")).toHaveCount(0);
});
