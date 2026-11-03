"use client";
import { useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { setStudentRooms, updateStudentName } from "../../actions";

export function RoomAssignments({ studentId, rooms, assigned }: { studentId: string; rooms: { id: string; name: string }[]; assigned: string[] }) {
  const [sel, setSel] = useState(new Set(assigned));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const dirty = sel.size !== assigned.length || assigned.some((a) => !sel.has(a));
  return (
    <div className="space-y-3">
      <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
        {rooms.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-0 hover:bg-canvas">
            <input
              type="checkbox"
              checked={sel.has(r.id)}
              onChange={(e) => {
                const n = new Set(sel);
                if (e.target.checked) n.add(r.id);
                else n.delete(r.id);
                setSel(n);
                setSaved(false);
              }}
            />
            <span className="font-medium">{r.name}</span>
          </label>
        ))}
        {rooms.length === 0 && <p className="p-3 text-sm text-muted">No rooms exist yet.</p>}
      </div>
      <div className="flex items-center gap-3">
        <Button
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              await setStudentRooms(studentId, [...sel]);
              setSaved(true);
            })
          }
        >
          {pending ? "Saving…" : "Save room assignments"}
        </Button>
        {saved && !dirty && <span className="text-sm text-ok">Saved</span>}
      </div>
    </div>
  );
}

export function EditName({ userId, name }: { userId: string; name: string }) {
  const [v, setV] = useState(name);
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Input value={v} onChange={(e) => setV(e.target.value)} maxLength={100} />
      <Button variant="secondary" disabled={pending || v.trim() === name || !v.trim()} onClick={() => start(() => updateStudentName(userId, v))}>
        Save
      </Button>
    </div>
  );
}
