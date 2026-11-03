/**
 * DEVELOPMENT ONLY: loads synthetic "[Sample]" questions (see src/lib/sample-questions.ts).
 *   npm run db:seed:samples -- 40     (questions per skill, default 40)
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { seedSampleQuestions } from "../src/lib/sample-questions";

seedSampleQuestions(Number(process.argv[2] ?? 40))
  .then(async (r) => {
    console.log(`Inserted ${r.inserted} sample questions (${r.existing} already existed).`);
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
