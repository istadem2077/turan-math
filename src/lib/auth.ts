import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession, type SessionRole } from "./session";

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function startSession(user: { id: string; role: SessionRole; fullName: string }) {
  const token = await signSession({ sub: user.id, role: user.role, name: user.fullName });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Current user from the DB (so deactivation takes effect immediately). */
export async function currentUser() {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { id: true, username: true, fullName: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

export async function requireRole(...roles: SessionRole[]): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!roles.includes(user.role)) redirect(user.role === "STUDENT" ? "/student" : "/staff");
  return user;
}

export const requireStaff = () => requireRole("ADMIN", "PROFESSOR");
export const requireAdmin = () => requireRole("ADMIN");
export const requireStudent = () => requireRole("STUDENT");

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function generatePassword(length = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
