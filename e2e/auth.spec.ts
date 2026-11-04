import { expect, test } from "@playwright/test";
import { login, newStudent, staffPage } from "./helpers";
import { ADMIN } from "./env";

test("signed-out visitors are sent to the login page", async ({ page }) => {
  for (const path of ["/", "/staff", "/student", "/staff/rooms"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("wrong password shows an error and stays on login", async ({ page }) => {
  await login(page, ADMIN.username, "not-the-password");
  await expect(page.getByText(/invalid|incorrect|wrong/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("staff land on the staff area and can sign out", async ({ browser }) => {
  const staff = await staffPage(browser);
  await expect(staff.getByRole("heading", { name: "Overview" })).toBeVisible();
  await staff.getByRole("button", { name: "Sign out" }).first().click();
  await expect(staff).toHaveURL(/\/login$/);
});

test("students can't open staff pages, and staff can't open student pages", async ({ browser }) => {
  const student = await newStudent(browser);
  await student.page.goto("/staff/rooms");
  await expect(student.page).toHaveURL(/\/student$/);

  const staff = await staffPage(browser);
  await staff.goto("/student");
  await expect(staff).toHaveURL(/\/staff$/);
});

test("file downloads require a session", async ({ request }) => {
  const res = await request.get("/api/files/does-not-exist", { maxRedirects: 0 });
  expect(res.status()).toBe(401);
});
