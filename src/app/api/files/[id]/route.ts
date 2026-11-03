import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { canReadFile } from "@/lib/files";
import { INLINE_EXTS, extOf } from "@/lib/file-formats";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  if (!(await canReadFile(user, id))) return new Response("Not found", { status: 404 });
  const file = await db.storedFile.findUnique({ where: { id } });
  if (!file) return new Response("Not found", { status: 404 });

  const download = new URL(req.url).searchParams.has("download") || !INLINE_EXTS.has(extOf(file.filename));
  const name = encodeURIComponent(file.filename);
  return new Response(file.data, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
