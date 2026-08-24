import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma's convention is to name a non-default Postgres schema in the
 * connection string (`...?schema=voltgrid`). The `pg` driver ignores that
 * parameter, so lift it out and hand it to the adapter instead — this is what
 * lets Volt Grid share one Postgres instance with another project without the
 * two sets of tables colliding.
 */
function parseConnection(url: string) {
  try {
    const parsed = new URL(url);
    const schema = parsed.searchParams.get("schema") ?? undefined;
    parsed.searchParams.delete("schema");
    return { connectionString: parsed.toString(), schema };
  } catch {
    return { connectionString: url, schema: undefined };
  }
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env, or set it in your host's environment.",
    );
  }
  const { connectionString, schema } = parseConnection(url);
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }, schema ? { schema } : undefined),
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
