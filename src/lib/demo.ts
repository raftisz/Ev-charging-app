/**
 * The public demo. The seeded accounts share one published password so anyone
 * can try the app, which also means anyone can sign in as them. They are
 * protected accordingly: their password, role and active flag cannot be
 * changed and they cannot be deleted, so one visitor cannot lock the next one
 * out. Everything else they do is undone by the daily reset.
 *
 * Dependency-free: imported by the seed script under plain Node as well as by
 * the app.
 */

export const DEMO_PASSWORD = "password123";

/** The accounts behind the "Try the demo" buttons on the sign-in page. */
export const DEMO_LOGINS = {
  driver: "user1@example.com",
  admin: "admin@example.com",
  operator: "operator@example.com",
} as const;

export type DemoLogin = keyof typeof DEMO_LOGINS;

/** When the cron job puts the demo back to its starting state, in Bangkok time. */
export const DEMO_RESET_TIME = "03:00";

const DEMO_EMAILS = new Set([
  "user1@example.com",
  "user2@example.com",
  "user3@example.com",
  "user4@example.com",
  "user5@example.com",
  "user6@example.com",
  "user7@example.com",
  "user8@example.com",
  "admin@example.com",
  "operator@example.com",
]);

export function isDemoAccount(email: string) {
  return DEMO_EMAILS.has(email.toLowerCase());
}

/**
 * Demo sign-in is on unless DEMO_MODE is set to "off", so a fresh deploy is
 * explorable straight away and a private deploy can switch it off.
 */
export function isDemoModeEnabled() {
  return process.env.DEMO_MODE !== "off";
}
