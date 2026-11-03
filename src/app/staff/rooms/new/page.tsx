import { db } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { RoomForm } from "../RoomForm";
import { createRoom } from "../../actions";
import { DEFAULT_MODULE_MINUTES } from "@/lib/blueprint";

export default async function NewRoomPage() {
  const tests = await db.test.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, title: true, source: true } });
  return (
    <>
      <PageHeader title="New room" subtitle="Schedule a fixed-start sitting. You can add students after creating it." />
      <Card>
        <RoomForm
          action={createRoom}
          tests={tests}
          submitLabel="Create room"
          initial={{ name: "", moduleMinutes: DEFAULT_MODULE_MINUTES, calculatorAllowed: true, testId: null }}
        />
      </Card>
    </>
  );
}
