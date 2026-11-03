/**
 * Idempotent start-up data: the SAT skill taxonomy and the initial admin
 * account. Runs automatically when the server starts (src/instrumentation.ts)
 * and from `npm run db:seed`.
 */
import bcrypt from "bcryptjs";
import { db } from "./db";
import { SKILLS } from "./taxonomy";
import { Prisma } from "@/generated/prisma/client";

export async function seedSkills() {
  for (const [i, s] of SKILLS.entries()) {
    await db.skill.upsert({
      where: { code: s.code },
      update: { name: s.name, domain: s.domain, sortOrder: i },
      create: { code: s.code, name: s.name, domain: s.domain, sortOrder: i },
    });
  }
  return SKILLS.length;
}

/** Creates the admin from ADMIN_* env vars if that username doesn't exist. Never overwrites a password. */
export async function ensureAdmin(): Promise<"created" | "exists" | "skipped"> {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return "skipped";
  if (await db.user.findUnique({ where: { username } })) return "exists";
  try {
    await db.user.create({
      data: {
        username,
        fullName: process.env.ADMIN_FULL_NAME || "Administrator",
        role: "ADMIN",
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    return "created";
  } catch (e) {
    // Another instance created it first.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "exists";
    throw e;
  }
}
