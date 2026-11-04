"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function format(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${h}h ${pad(m)}m`;
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${m}:${pad(sec)}`;
}

/** Counts down to `to`, then refreshes the page so the next state renders. */
export function Countdown({ to, className }: { to: string; className?: string }) {
  const router = useRouter();
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const target = new Date(to).getTime();
    const tick = () => {
      const l = target - Date.now();
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        setTimeout(() => router.refresh(), 800);
      }
    };
    const t = setInterval(tick, 1000);
    tick();
    return () => clearInterval(t);
  }, [to, router]);
  return <div className={className ?? "font-mono text-xl font-bold tabular-nums"}>{left === null ? "…" : format(left)}</div>;
}
