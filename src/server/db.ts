import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { parseDatabaseUrl, requireDatabaseUrl } from "@/server/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const { connectionString, schema } = parseDatabaseUrl(requireDatabaseUrl());
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }, schema ? { schema } : undefined),
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
