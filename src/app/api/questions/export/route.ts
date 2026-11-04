import { currentUser } from "@/lib/auth";
import { cleanFilters, questionWhere } from "@/lib/question-filters";
import { exportQuestions } from "@/lib/question-store";

/**
 * GET /api/questions/export?<question bank filters>: the matching questions as
 * a self-contained JSON file (figures embedded) for Question bank → Import on
 * another installation. Admins only.
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const rows = await exportQuestions(questionWhere(cleanFilters(sp)));
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(rows, null, 1), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="questions-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
