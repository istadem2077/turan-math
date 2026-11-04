/** Edge-safe session token helpers (used by middleware and server code). */
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "tm_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type SessionRole = "ADMIN" | "PROFESSOR" | "STUDENT";
export type SessionPayload = { sub: string; role: SessionRole; name: string };

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ role: p.role, name: p.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, role: payload.role as SessionRole, name: String(payload.name ?? "") };
  } catch {
    return null;
  }
}

export function homeFor(role: SessionRole): string {
  return role === "STUDENT" ? "/student" : "/staff";
}
