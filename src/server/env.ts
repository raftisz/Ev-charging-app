/**
 * The one place that reads DATABASE_URL and JWT_SECRET.
 *
 * Deliberately NOT marked `server-only`, and deliberately dependency-free:
 * this module is imported by `prisma.config.ts` and `prisma/seed.ts`, which
 * run under plain Node via `tsx` during `npm start` and `vercel-build`. The
 * `server-only` package resolves through Next's bundler alias, so importing
 * it here would break both deploy paths. Nothing here is client-safe all the
 * same — no caller outside `src/server`, `prisma.config.ts` and `prisma/`
 * should import it, and no value is exposed under a `NEXT_PUBLIC_` name, so
 * none of it can reach the browser bundle.
 *
 * Each variable is validated lazily, by the caller that actually needs it.
 * A module-level check would make `prisma.config.ts` demand a JWT_SECRET it
 * never uses.
 */

const DATABASE_URL_HELP = [
  "DATABASE_URL is not set.",
  "",
  "  Locally:  cp .env.example .env && npm run db:up",
  "  Deploys:  add DATABASE_URL to the host's environment variables,",
  "            then redeploy. On Vercel it must be enabled for the",
  "            environment being built (Production / Preview), and the",
  "            build has to run after it was saved.",
  "",
  "It should look like postgresql://user:password@host:5432/dbname",
].join("\n");

const JWT_SECRET_HELP = [
  "JWT_SECRET is not set.",
  "",
  "  Locally:  cp .env.example .env",
  "  Deploys:  add JWT_SECRET to the host's environment variables,",
  "            then redeploy.",
  "",
  'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"',
].join("\n");

/** Is the variable present? For health reporting — never returns its value. */
export function isDatabaseUrlSet() {
  return Boolean(process.env.DATABASE_URL);
}

/** Is the variable present? For health reporting — never returns its value. */
export function isJwtSecretSet() {
  return Boolean(process.env.JWT_SECRET);
}

/** The connection string, or an error that says how to set it. */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error(DATABASE_URL_HELP);
  return url;
}

/** The signing key, or an error that says how to set it. */
export function requireJwtSecret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error(JWT_SECRET_HELP);
  return value;
}

/**
 * Prisma's convention is to name a non-default Postgres schema in the
 * connection string (`...?schema=voltgrid`). The `pg` driver ignores that
 * parameter, so lift it out and hand it to the adapter instead — this is what
 * lets Volt Grid share one Postgres instance with another project without the
 * two sets of tables colliding.
 */
export function parseDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    const schema = parsed.searchParams.get("schema") ?? undefined;
    parsed.searchParams.delete("schema");
    return { connectionString: parsed.toString(), schema };
  } catch {
    return { connectionString: url, schema: undefined };
  }
}
