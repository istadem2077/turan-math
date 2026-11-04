import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { RoomTabs } from "./tabs";

export default async function RoomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = await db.room.findUnique({
    where: { id },
    include: { _count: { select: { members: true, quizzes: true, homeworks: true, materials: true } } },
  });
  if (!room) notFound();
  return (
    <>
      <Link href="/staff/rooms" className="text-sm font-semibold text-brand hover:underline">
        ← Rooms
      </Link>
      <div className="mt-1 mb-4">
        <h1 className="text-2xl font-bold tracking-tight">{room.name}</h1>
        {room.description && <p className="mt-1 text-sm whitespace-pre-line text-muted">{room.description}</p>}
      </div>
      <RoomTabs
        roomId={id}
        counts={{ students: room._count.members, quizzes: room._count.quizzes, homework: room._count.homeworks, materials: room._count.materials }}
      />
      <div className="mt-6">{children}</div>
    </>
  );
}
