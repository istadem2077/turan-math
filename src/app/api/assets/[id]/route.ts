import { db } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const asset = await db.asset.findUnique({ where: { id } });
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(asset.data, {
    headers: {
      "Content-Type": asset.mimeType,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
