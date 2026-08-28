import "dotenv/config";
import { defineConfig } from "prisma/config";
import { requireDatabaseUrl } from "./src/server/env";

/**
 * Prisma reports a missing DATABASE_URL as "The datasource.url property is
 * required in your Prisma config file", which sends you looking at this file
 * rather than at the environment. `requireDatabaseUrl` says what is actually
 * wrong instead. Imported by relative path, not the `@/` alias, because this
 * file is read by the Prisma CLI rather than compiled by Next.
 */
const url = requireDatabaseUrl();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: { url },
});
