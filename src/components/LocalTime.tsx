"use client";
import { useEffect, useState } from "react";

/** Formats a timestamp in the viewer's own timezone (avoids server-TZ drift). */
export function LocalTime({ iso, mode = "datetime" }: { iso: string; mode?: "datetime" | "date" | "time" }) {
  const [text, setText] = useState<string>("");
  useEffect(() => {
    const d = new Date(iso);
    const opts: Intl.DateTimeFormatOptions =
      mode === "date"
        ? { dateStyle: "medium" }
        : mode === "time"
          ? { timeStyle: "short" }
          : { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
    setText(new Intl.DateTimeFormat(undefined, opts).format(d));
  }, [iso, mode]);
  return <time dateTime={iso} suppressHydrationWarning>{text || " "}</time>;
}

/** datetime-local input that submits an ISO (UTC) value under `name`. */
export function DateTimeInput({ name, defaultIso, required }: { name: string; defaultIso?: string; required?: boolean }) {
  const [local, setLocal] = useState("");
  useEffect(() => {
    if (!defaultIso) return;
    const d = new Date(defaultIso);
    const pad = (n: number) => String(n).padStart(2, "0");
    setLocal(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }, [defaultIso]);
  return (
    <>
      <input
        type="datetime-local"
        value={local}
        required={required}
        onChange={(e) => setLocal(e.target.value)}
        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <input type="hidden" name={name} value={local ? new Date(local).toISOString() : ""} />
    </>
  );
}
