import { expect, test, type Page } from "@playwright/test";
import { addToRoom, createRoom, generateTest, idFromUrl, localDateTime, newStudent, sql, staffPage } from "./helpers";

let testTitle: string;

test.beforeAll(async ({ browser }) => {
  const staff = await staffPage(browser);
  testTitle = await generateTest(staff);
  await staff.context().close();
});

async function createQuiz(staff: Page, roomId: string, title: string) {
  await staff.goto(`/staff/rooms/${roomId}/quizzes/new`);
  await expect(staff.getByLabel("Minutes per module")).toHaveValue("27");
  await staff.getByLabel("Title").fill(title);
  await staff.getByLabel("Test").selectOption({ label: `${testTitle} (random)` });
  return staff;
}

/** Answers the current question: choice A for multiple choice, "1" for a grid-in. */
async function answerCurrent(exam: Page) {
  const choice = exam.locator("[data-choice='A']");
  if (await choice.count()) await choice.click();
  else await exam.getByLabel("Your answer").fill("1");
}

async function finishModule(exam: Page, confirm: "Continue" | "Submit") {
  await exam.getByRole("button", { name: /Question \d+ of 22/ }).click();
  await exam.getByRole("button", { name: "Go to Review Page" }).click();
  await exam.getByRole("button", { name: "Next" }).click();
  await exam.getByRole("button", { name: confirm, exact: true }).click();
}

test("professor starts a quiz; students join from the lobby, take it, and see released results", async ({ browser }) => {
  const staff = await staffPage(browser);
  const room = await createRoom(staff);
  const alice = await newStudent(browser, "Alice");
  const outsider = await newStudent(browser, "Outsider");
  await addToRoom(room.id, alice.id);

  await createQuiz(staff, room.id, "Quiz 1");
  await staff.getByRole("button", { name: "Create quiz" }).click();
  const quizId = await idFromUrl(staff, /\/quizzes\/[a-z0-9]+$/);
  await expect(staff.getByText("Not started")).toBeVisible();

  // Not started: invisible to students.
  await alice.page.goto(`/student/rooms/${room.id}`);
  await expect(alice.page.getByText("Quiz 1")).toHaveCount(0);

  // Start: a 5-minute lobby opens.
  staff.once("dialog", (d) => d.accept());
  await staff.getByRole("button", { name: "Start quiz" }).click();
  await expect(staff.getByText("Lobby is open")).toBeVisible();
  const [{ secs }] = await sql<{ secs: number }>(`SELECT extract(epoch FROM "startsAt" - now())::int AS secs FROM "Quiz" WHERE id = $1`, [quizId]);
  expect(secs).toBeGreaterThan(280);
  expect(secs).toBeLessThanOrEqual(300);

  await alice.page.goto("/student");
  await alice.page.getByRole("link", { name: "Enter quiz" }).click();
  await expect(alice.page.getByText("Stay on this page")).toBeVisible();

  // Students outside the room can't open it.
  const res = await outsider.page.goto(`/student/rooms/${room.id}/quizzes/${quizId}`);
  expect(res?.status()).toBe(404);

  // Skip the lobby wait: module 1 opens now.
  await sql(`UPDATE "Quiz" SET "startsAt" = now() - interval '1 second' WHERE id = $1`, [quizId]);
  await alice.page.reload();
  const exam = alice.page;
  await expect(exam.getByRole("button", { name: "Question 1 of 22" })).toBeVisible();
  await answerCurrent(exam);
  // The answer is saved on the server.
  await expect
    .poll(async () => (await sql(`SELECT 1 FROM "Response" r JOIN "Attempt" a ON a.id = r."attemptId" WHERE a."quizId" = $1 AND r.answer IS NOT NULL`, [quizId])).length)
    .toBe(1);

  // Staff see the student working.
  await staff.reload();
  await expect(staff.getByText(/Module 1 · 1 answered/)).toBeVisible();

  await finishModule(exam, "Continue");
  await expect(exam.getByRole("button", { name: "Question 1 of 22" })).toBeVisible();
  await answerCurrent(exam);
  await finishModule(exam, "Submit");
  await expect(exam.getByText("You're all finished!")).toBeVisible();
  await expect(exam.getByText(/will release your score/)).toBeVisible();

  // Release results.
  await staff.reload();
  await expect(staff.getByText("Submitted", { exact: true })).toBeVisible();
  staff.once("dialog", (d) => d.accept());
  await staff.getByRole("button", { name: "Release results" }).click();
  await expect(staff.getByRole("button", { name: "Hide results from students" })).toBeVisible();

  await alice.page.goto(`/student/rooms/${room.id}`);
  await alice.page.getByRole("link", { name: /View results/ }).click();
  await expect(alice.page.getByRole("heading", { name: "Quiz 1 — results" })).toBeVisible();
});

test("a quiz can be scheduled, then cancelled", async ({ browser }) => {
  const staff = await staffPage(browser);
  const room = await createRoom(staff);
  const bob = await newStudent(browser, "Bob");
  await addToRoom(room.id, bob.id);

  await createQuiz(staff, room.id, "Midterm");
  await staff.getByLabel(/Schedule a start time/).check();
  await staff.locator("input[type=datetime-local]").fill(localDateTime(2 * 24 * 3600_000));
  await staff.getByRole("button", { name: "Create quiz" }).click();
  await expect(staff.getByText(/Scheduled for/)).toBeVisible();

  await bob.page.goto(`/student/rooms/${room.id}`);
  await expect(bob.page.getByText("Midterm")).toBeVisible();
  await expect(bob.page.getByText("Starts in")).toBeVisible();

  staff.once("dialog", (d) => d.accept());
  await staff.getByRole("button", { name: "Cancel schedule" }).click();
  await expect(staff.getByRole("button", { name: "Start quiz" })).toBeVisible();

  await bob.page.reload();
  await expect(bob.page.getByText("Midterm")).toHaveCount(0);
});

test("a quiz can't be started without a test", async ({ browser }) => {
  const staff = await staffPage(browser);
  const room = await createRoom(staff);
  await staff.goto(`/staff/rooms/${room.id}/quizzes/new`);
  await staff.getByLabel("Title").fill("No test yet");
  await staff.getByRole("button", { name: "Create quiz" }).click();
  await expect(staff.getByText(/Choose a test in the settings below/)).toBeVisible();
  await expect(staff.getByRole("button", { name: "Start quiz" })).toHaveCount(0);
});
