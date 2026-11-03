"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { addRoomMembers, moveRoomMember } from "../../actions";

export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

export function AddMembers({ roomId, students }: { roomId: string; students: { id: string; fullName: string; username: string }[] }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return students.filter((x) => !s || x.fullName.toLowerCase().includes(s) || x.username.includes(s));
  }, [q, students]);
  if (students.length === 0) return <p className="text-sm text-muted">Every active student is already in this room.</p>;
  return (
    <div className="space-y-3">
      <Input placeholder="Search students…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
        {shown.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-0 hover:bg-canvas">
            <input
              type="checkbox"
              checked={sel.has(s.id)}
              onChange={(e) => {
                const n = new Set(sel);
                if (e.target.checked) n.add(s.id);
                else n.delete(s.id);
                setSel(n);
              }}
            />
            <span className="font-medium">{s.fullName}</span>
            <span className="text-muted">@{s.username}</span>
          </label>
        ))}
        {shown.length === 0 && <p className="p-3 text-sm text-muted">No matches.</p>}
      </div>
      <Button
        disabled={pending || sel.size === 0}
        onClick={() =>
          start(async () => {
            await addRoomMembers(roomId, [...sel]);
            setSel(new Set());
          })
        }
      >
        {pending ? "Adding…" : `Add ${sel.size || ""} to room`}
      </Button>
    </div>
  );
}

export function MoveMember({ roomId, studentId, rooms }: { roomId: string; studentId: string; rooms: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  if (rooms.length === 0) return null;
  return (
    <select
      className="rounded-md border border-line bg-white px-2 py-1 text-xs"
      disabled={pending}
      value=""
      onChange={(e) => {
        const to = e.target.value;
        if (to) start(() => moveRoomMember(roomId, to, studentId));
      }}
    >
      <option value="">{pending ? "Moving…" : "Move to…"}</option>
      {rooms.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}
