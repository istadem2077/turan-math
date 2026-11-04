import Link from "next/link";
import { logout } from "@/app/login/actions";

export function StudentShell({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/student" className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 font-black">T</div>
            <span className="font-bold">Turan Math</span>
          </Link>
          <form action={logout} className="flex items-center gap-4 text-sm">
            <span className="hidden text-white/80 sm:inline">{name}</span>
            <button className="font-semibold text-white/90 hover:text-white">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">{children}</main>
    </div>
  );
}
