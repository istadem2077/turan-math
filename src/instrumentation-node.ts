/**
 * Start-up seeding (Node.js runtime only): makes sure the skill taxonomy and
 * the admin account exist, and optionally loads sample questions
 * (SEED_SAMPLE_QUESTIONS=true). Set AUTO_SEED=false to disable.
 */
import { ensureAdmin, seedSkills } from "./lib/bootstrap";
import { seedSampleQuestions } from "./lib/sample-questions";

export async function startup() {
  if (process.env.AUTO_SEED === "false") return;
  try {
    await seedSkills();
    const admin = await ensureAdmin();
    if (admin === "created") console.log(`[startup] Admin "${process.env.ADMIN_USERNAME}" created.`);
    if (admin === "skipped") console.warn("[startup] ADMIN_USERNAME / ADMIN_PASSWORD not set; no admin account created.");
    if (process.env.SEED_SAMPLE_QUESTIONS === "true") {
      const r = await seedSampleQuestions();
      console.log(`[startup] Sample questions: ${r.inserted} inserted, ${r.existing} already present.`);
    }
  } catch (e) {
    console.error("[startup] Seeding failed:", e);
  }
}
