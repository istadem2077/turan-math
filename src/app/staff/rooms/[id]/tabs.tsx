"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export function RoomTabs({ roomId, counts }: { roomId: string; counts: { students: number; quizzes: number; homework: number; materials: number } }) {
  const path = usePathname();
  const base = `/staff/rooms/${roomId}`;
  const tabs = [
    { href: base, label: "Students", count: counts.students, exact: true },
    { href: `${base}/quizzes`, label: "Quizzes", count: counts.quizzes },
    { href: `${base}/homework`, label: "Homework", count: counts.homework },
    { href: `${base}/materials`, label: "Materials", count: counts.materials },
    { href: `${base}/settings`, label: "Settings" },
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => {
        const active = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cx(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition",
              active ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 rounded-full bg-canvas px-1.5 py-0.5 text-xs text-muted">{t.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
