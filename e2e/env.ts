/** Settings shared by the Playwright config, global setup and tests. */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3200);
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://turan:turan@localhost:5432/turan_math_e2e";
export const ADMIN = { username: "e2e-admin", password: "e2e-admin-password" };

/** Environment for the app server and seed scripts under test. */
export const E2E_ENV: Record<string, string> = {
  DATABASE_URL: E2E_DATABASE_URL,
  SESSION_SECRET: "e2e-session-secret-0123456789abcdef0123456789",
  ADMIN_USERNAME: ADMIN.username,
  ADMIN_PASSWORD: ADMIN.password,
  ADMIN_FULL_NAME: "E2E Admin",
  COOKIE_SECURE: "false",
  SEED_SAMPLE_QUESTIONS: "false",
  NEXT_TELEMETRY_DISABLED: "1",
};
