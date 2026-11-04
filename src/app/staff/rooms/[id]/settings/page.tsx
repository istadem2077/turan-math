import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card } from "@/components/ui";
import { ActionButton } from "@/components/client-ui";
import { RoomForm } from "../../RoomForm";
import { deleteRoom, updateRoom } from "../../actions";

export default async function RoomSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = await db.room.findUnique({ where: { id } });
  if (!room) notFound();
  return (
    <div className="space-y-6">
      <Card title="Room details">
        <RoomForm action={updateRoom.bind(null, id)} submitLabel="Save" initial={{ name: room.name, description: room.description ?? "" }} />
      </Card>
      <Card title="Danger zone">
        <p className="mb-4 text-sm text-muted">Deleting the room deletes its quizzes (with every attempt), its homework (with every submission and file), and the student assignments. Student accounts are kept.</p>
        <ActionButton variant="danger" action={deleteRoom.bind(null, id)} confirm="Delete this room with all of its quizzes, attempts, homework and submissions? This can't be undone.">
          Delete room
        </ActionButton>
      </Card>
    </div>
  );
}
