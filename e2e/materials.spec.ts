import { expect, test } from "@playwright/test";
import path from "node:path";
import { addToRoom, createRoom, newStudent, sql, staffPage } from "./helpers";

const PDF = path.resolve("e2e/fixtures/homework.pdf");
const PPTX = path.resolve("e2e/fixtures/slides.pptx");
const TXT = path.resolve("e2e/fixtures/notes.txt");

test("lecture materials: files and links, visible only to the room", async ({ browser }) => {
  const staff = await staffPage(browser);
  const room = await createRoom(staff);
  const erin = await newStudent(browser, "Erin");
  const outsider = await newStudent(browser, "Outsider");
  await addToRoom(room.id, erin.id);

  // Wrong format is rejected.
  await staff.goto(`/staff/rooms/${room.id}/materials/new`);
  await staff.getByLabel("Title").fill("Lecture 1");
  await staff.locator("input[name=files]").setInputFiles(TXT);
  await staff.getByRole("button", { name: "Post" }).click();
  await expect(staff.getByText(/isn't an accepted format/).last()).toBeVisible();

  // Slides as PDF + PowerPoint.
  await staff.locator("input[name=files]").setInputFiles([PDF, PPTX]);
  await staff.locator("textarea[name=description]").fill("Slides for $x^2$ week.");
  await staff.getByRole("button", { name: "Post" }).click();
  await expect(staff).toHaveURL(/\/materials$/);
  await expect(staff.getByRole("heading", { name: "Lecture 1" })).toBeVisible();

  // Nothing at all is rejected; a non-web link is rejected; a web link alone is fine.
  await staff.goto(`/staff/rooms/${room.id}/materials/new`);
  await staff.getByLabel("Title").fill("Video");
  await staff.getByRole("button", { name: "Post" }).click();
  await expect(staff.getByText("Attach at least one file or add a link.")).toBeVisible();
  await staff.getByLabel(/^Link/).fill("ftp://example.com/video");
  await staff.getByRole("button", { name: "Post" }).click();
  await expect(staff.getByText(/must start with http/)).toBeVisible();
  await staff.getByLabel(/^Link/).fill("https://www.example.com/lecture-video");
  await staff.getByRole("button", { name: "Post" }).click();
  await expect(staff).toHaveURL(/\/materials$/);
  await expect(staff.getByRole("link", { name: /^Materials\s*2$/ })).toBeVisible(); // tab count

  // The student sees both on their room page.
  await erin.page.goto(`/student/rooms/${room.id}`);
  await expect(erin.page.getByRole("heading", { name: "Lecture 1" })).toBeVisible();
  await expect(erin.page.getByRole("heading", { name: "Video" })).toBeVisible();
  const link = erin.page.getByRole("link", { name: /example\.com/ });
  await expect(link).toHaveAttribute("href", "https://www.example.com/lecture-video");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(erin.page.locator(".katex").first()).toBeVisible();

  // Files: the student can open them (PDF inline, PowerPoint downloads); outsiders can't.
  const files = await sql<{ id: string; filename: string }>(
    `SELECT f.id, f.filename FROM "StoredFile" f JOIN "Material" m ON m.id = f."materialId" WHERE m."roomId" = $1`,
    [room.id],
  );
  const pdf = files.find((f) => f.filename.endsWith(".pdf"))!;
  const pptx = files.find((f) => f.filename.endsWith(".pptx"))!;
  const pdfRes = await erin.page.request.get(`/api/files/${pdf.id}`);
  expect(pdfRes.status()).toBe(200);
  expect(pdfRes.headers()["content-disposition"]).toMatch(/^inline/);
  const pptxRes = await erin.page.request.get(`/api/files/${pptx.id}`);
  expect(pptxRes.headers()["content-disposition"]).toMatch(/^attachment/);
  expect(pptxRes.headers()["content-type"]).toContain("presentationml");
  expect((await outsider.page.request.get(`/api/files/${pdf.id}`)).status()).toBe(404);
  expect((await outsider.page.goto(`/student/rooms/${room.id}`))?.status()).toBe(404);

  // Edit: remove the PDF; the last file can't go while there's no link.
  await staff.getByRole("article").filter({ hasText: "Lecture 1" }).getByRole("link", { name: "Edit" }).click();
  staff.on("dialog", (d) => d.accept());
  await staff.getByRole("listitem").filter({ hasText: "homework.pdf" }).getByRole("button", { name: "Remove" }).click();
  await expect(staff.getByText("homework.pdf")).toHaveCount(0);
  await staff.getByRole("listitem").filter({ hasText: "slides.pptx" }).getByRole("button", { name: "Remove" }).click();
  await expect(staff.getByText(/only file and there's no link/)).toBeVisible();

  // Delete: gone for the student.
  await staff.getByRole("button", { name: "Delete material" }).click();
  await expect(staff).toHaveURL(/\/materials$/);
  await erin.page.reload();
  await expect(erin.page.getByRole("heading", { name: "Lecture 1" })).toHaveCount(0);
  await expect(erin.page.getByRole("heading", { name: "Video" })).toBeVisible();
});
