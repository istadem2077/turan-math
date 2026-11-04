import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card } from "@/components/ui";
import { ActionButton } from "@/components/client-ui";
import { FileList } from "@/components/FileList";
import { FILE_META } from "@/lib/files";
import { MaterialForm } from "../MaterialForm";
import { deleteMaterial, deleteStaffFile, updateMaterial } from "../../../actions";

export default async function EditMaterialPage({ params }: { params: Promise<{ id: string; mid: string }> }) {
  const { id, mid } = await params;
  const m = await db.material.findFirst({
    where: { id: mid, roomId: id },
    include: { files: { select: FILE_META, orderBy: { createdAt: "asc" } } },
  });
  if (!m) notFound();
  return (
    <div className="space-y-6">
      <Link href={`/staff/rooms/${id}/materials`} className="text-sm font-semibold text-brand hover:underline">
        ← Materials
      </Link>
      {m.files.length > 0 && (
        <Card title="Files">
          <FileList files={m.files} onDelete={(fid) => deleteStaffFile.bind(null, fid)} />
        </Card>
      )}
      <Card title="Edit material">
        <MaterialForm
          action={updateMaterial.bind(null, mid)}
          submitLabel="Save"
          initial={{ title: m.title, description: m.description, url: m.url ?? "" }}
        />
        <p className="mt-3 text-xs text-muted">Files you choose here are added to the ones above.</p>
      </Card>
      <div className="flex justify-end">
        <ActionButton variant="danger" action={deleteMaterial.bind(null, mid)} confirm="Delete this material and its files?">
          Delete material
        </ActionButton>
      </div>
    </div>
  );
}
