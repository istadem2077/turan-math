"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export function StaffNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  const items = [
    { href: "/staff", label: "Overview", exact: true },
    { href: "/staff/rooms", label: "Rooms" },
    { href: "/staff/students", label: "Students" },
    { href: "/staff/tests", label: "Tests" },
    { href: "/staff/questions", label: "Question bank" },
    ...(isAdmin ? [{ href: "/staff/professors", label: "Professors" }] : []),
  ];
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {items.map((it) => {
        const active = it.exact ? path === it.href : path.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cx(
              "rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition",
              active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
