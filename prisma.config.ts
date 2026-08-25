import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma reports a missing DATABASE_URL as "The datasource.url property is
 * required in your Prisma config file", which sends you looking at this file
 * rather than at the environment. Say what is actually wrong instead.
 */
const url = process.env["DATABASE_URL"];

if (!url) {
  throw new Error(
    [
      "DATABASE_URL is not set.",
      "",
      "  Locally:  cp .env.example .env && npm run db:up",
      "  Deploys:  add DATABASE_URL to the host's environment variables,",
      "            then redeploy. On Vercel it must be enabled for the",
      "            environment being built (Production / Preview), and the",
      "            build has to run after it was saved.",
      "",
      "It should look like postgresql://user:password@host:5432/dbname",
    ].join("\n"),
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: { url },
});
