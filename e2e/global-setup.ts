import { execSync } from "node:child_process";
import pg from "pg";
import { E2E_DATABASE_URL, E2E_ENV } from "./env";

/**
 * Prepares the e2e database without deleting anything: creates it if missing,
 * applies migrations, and seeds skills, the admin and the sample question bank
 * (all idempotent). Tests use unique names, so leftovers from earlier local
 * runs don't matter; in CI the database is new on every run.
 */
export default async function globalSetup() {
  const url = new URL(E2E_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  // Seeding sample questions and test users must never touch a real database.
  if (!/e2e|test/i.test(dbName)) throw new Error(`E2E_DATABASE_URL must name a database containing "e2e" or "test" (got "${dbName}").`);

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!rowCount) await client.query(`CREATE DATABASE "${dbName.replace(/"/g, "")}"`);
  } finally {
    await client.end();
  }

  const env = { ...process.env, ...E2E_ENV };
  const run = (cmd: string) => execSync(cmd, { env, stdio: "inherit" });
  run("npx prisma migrate deploy");
  run("npx tsx prisma/seed.ts");
  run("npx tsx prisma/seed-samples.ts");
}
