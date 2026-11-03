import { Card, PageHeader } from "@/components/ui";
import { RoomForm } from "../RoomForm";
import { createRoom } from "../actions";

export default function NewRoomPage() {
  return (
    <>
      <PageHeader title="New room" subtitle="A room is a classroom: a group of students. Add students, quizzes and homework after creating it." />
      <Card>
        <RoomForm action={createRoom} submitLabel="Create room" initial={{ name: "", description: "" }} />
      </Card>
    </>
  );
}
