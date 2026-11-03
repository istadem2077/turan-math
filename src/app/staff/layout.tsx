import { requireStaff } from "@/lib/auth";
import { logout } from "@/app/login/actions";
import { StaffNav } from "./nav";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-navy text-white md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:shrink-0">
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:block md:px-5 md:py-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 font-black">T</div>
            <span className="font-bold">Turan Math</span>
          </div>
        </div>
        <div className="px-3 pb-3 md:flex-1">
          <StaffNav isAdmin={user.role === "ADMIN"} />
        </div>
        <div className="hidden border-t border-white/10 px-5 py-4 md:block">
          <div className="text-sm font-medium">{user.fullName}</div>
          <div className="text-xs text-white/60">{user.role === "ADMIN" ? "Administrator" : "Professor"} · @{user.username}</div>
          <form action={logout} className="mt-3">
            <button className="text-xs font-semibold text-white/80 hover:text-white">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
        <form action={logout} className="mt-10 md:hidden">
          <button className="text-sm font-semibold text-muted">Sign out ({user.username})</button>
        </form>
      </main>
    </div>
  );
}
