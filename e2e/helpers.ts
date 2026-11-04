import { expect, type Browser, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import pg from "pg";
import { ADMIN, E2E_DATABASE_URL } from "./env";

/** Direct database access, for fixtures and for moving the clock (e.g. starting a quiz "now"). */
export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(text, params)).rows as T[];
  } finally {
    await client.end();
  }
}

/** Short unique suffix so tests never collide on names. */
export const uid = () => Math.random().toString(36).slice(2, 8);

export async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** A new browser context signed in as the admin (staff). */
export async function staffPage(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  await login(page, ADMIN.username, ADMIN.password);
  await expect(page).toHaveURL(/\/staff$/);
  return page;
}

/** Creates a student directly in the database and returns a signed-in page for them. */
export async function newStudent(browser: Browser, name = "Student") {
  const username = `st-${uid()}`;
  const password = "student-pass";
  const fullName = `${name} ${username}`;
  const [row] = await sql<{ id: string }>(
    `INSERT INTO "User" (id, username, "passwordHash", "fullName", role, "updatedAt")
     VALUES ($1, $2, $3, $4, 'STUDENT', now()) RETURNING id`,
    [`e2e${uid()}${uid()}`, username, await bcrypt.hash(password, 4), fullName],
  );
  const page = await (await browser.newContext()).newPage();
  await login(page, username, password);
  await expect(page).toHaveURL(/\/student$/);
  return { id: row.id, username, fullName, page };
}

export async function addToRoom(roomId: string, studentId: string) {
  await sql(`INSERT INTO "RoomMember" ("roomId", "studentId") VALUES ($1, $2)`, [roomId, studentId]);
}

/** Creates a room through the UI and returns its id. */
export async function createRoom(staff: Page, name = `Room ${uid()}`) {
  await staff.goto("/staff/rooms/new");
  await staff.getByLabel("Room name").fill(name);
  await staff.getByRole("button", { name: "Create room" }).click();
  await staff.waitForURL((u) => /\/staff\/rooms\/[a-z0-9]+$/.test(u.pathname) && !u.pathname.endsWith("/new"));
  return { id: staff.url().split("/").pop()!, name };
}

/** Generates a random 44-question test through the UI and returns its title. */
export async function generateTest(staff: Page, title = `Test ${uid()}`) {
  await staff.goto("/staff/tests");
  await staff.getByPlaceholder(/Test title/).fill(title);
  await staff.getByRole("button", { name: "Generate random test" }).click();
  await staff.waitForURL((u) => /\/staff\/tests\/[a-z0-9]+$/.test(u.pathname) && !u.pathname.endsWith("/new"));
  return title;
}

/** Last path segment of the current URL once it matches `pattern` (e.g. a new quiz's id). */
export async function idFromUrl(page: Page, pattern: RegExp) {
  await page.waitForURL((u) => pattern.test(u.pathname) && !u.pathname.endsWith("/new"));
  return page.url().split("/").pop()!;
}

/** Local value for <input type="datetime-local">, `ms` from now. */
export function localDateTime(ms: number) {
  const d = new Date(Date.now() + ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
