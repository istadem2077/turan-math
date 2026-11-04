/**
 * Idempotent seed: skill taxonomy + the initial admin account (from ADMIN_* env).
 * The server also does this automatically on start-up.
 *   npm run db:seed
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { ensureAdmin, seedSkills } from "../src/lib/bootstrap";

async function main() {
  console.log(`Skills: ${await seedSkills()}`);
  const admin = await ensureAdmin();
  if (admin === "skipped") throw new Error("Set ADMIN_USERNAME and ADMIN_PASSWORD");
  console.log(admin === "created" ? "Admin created." : "Admin already exists (password unchanged).");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
