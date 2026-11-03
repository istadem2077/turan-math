/**
 * Idempotent production seed: skill taxonomy + the initial admin account.
 *   npm run db:seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { SKILLS } from "../src/lib/taxonomy";

async function main() {
  for (const [i, s] of SKILLS.entries()) {
    await db.skill.upsert({
      where: { code: s.code },
      update: { name: s.name, domain: s.domain, sortOrder: i },
      create: { code: s.code, name: s.name, domain: s.domain, sortOrder: i },
    });
  }
  console.log(`Skills: ${SKILLS.length}`);

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) throw new Error("Set ADMIN_USERNAME and ADMIN_PASSWORD");
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`Admin "${username}" already exists (password unchanged).`);
  } else {
    await db.user.create({
      data: {
        username,
        fullName: process.env.ADMIN_FULL_NAME || "Administrator",
        role: "ADMIN",
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    console.log(`Admin "${username}" created.`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
