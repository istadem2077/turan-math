import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, homeFor, verifySession } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/login") {
    return session ? NextResponse.redirect(new URL(homeFor(session.role), req.url)) : NextResponse.next();
  }
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const isStaffArea = pathname.startsWith("/staff");
  const isStudentArea = pathname.startsWith("/student");
  if ((isStaffArea && session.role === "STUDENT") || (isStudentArea && session.role !== "STUDENT")) {
    return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  }
  if (pathname === "/") return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/staff/:path*", "/student/:path*"],
};
