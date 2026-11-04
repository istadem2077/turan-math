import { db } from "@/lib/db";
import { Empty, LinkButton } from "@/components/ui";
import { MaterialCard } from "@/components/MaterialCard";
import { FILE_META } from "@/lib/files";

export default async function RoomMaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const materials = await db.material.findMany({
    where: { roomId: id },
    orderBy: { createdAt: "desc" },
    include: { files: { select: FILE_META, orderBy: { createdAt: "asc" } } },
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Lecture slides, documents and links. Only students in this room can see them.</p>
        <LinkButton href={`/staff/rooms/${id}/materials/new`}>Post material</LinkButton>
      </div>
      {materials.length === 0 ? (
        <Empty>Nothing posted yet.</Empty>
      ) : (
        materials.map((m) => (
          <MaterialCard
            key={m.id}
            m={m}
            actions={
              <LinkButton variant="secondary" href={`/staff/rooms/${id}/materials/${m.id}`}>
                Edit
              </LinkButton>
            }
          />
        ))
      )}
    </div>
  );
}
