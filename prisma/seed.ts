/**
 * Resets and repopulates the Volt Grid demo database.
 *
 *   npm run seed              wipe and reseed
 *   npm run seed -- --if-empty   seed only when the database has no stations
 *
 * The `--if-empty` form is what deploys run: the first boot fills an empty
 * database, and later deploys leave real accounts and sessions alone.
 * The data itself lives in ./demo-data.ts.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { parseDatabaseUrl, requireDatabaseUrl } from "../src/server/env";
import { DEMO_PASSWORD } from "../src/lib/demo";
import { seedDemoData } from "./demo-data";

const { connectionString, schema } = parseDatabaseUrl(requireDatabaseUrl());

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }, schema ? { schema } : undefined),
});

async function main() {
  const onlyIfEmpty = process.argv.includes("--if-empty");

  if (onlyIfEmpty) {
    const existing = await prisma.station.count();
    if (existing > 0) {
      console.log(`Database already has ${existing} stations — skipping seed.`);
      return;
    }
    console.log("Database is empty — seeding demo data.");
  }

  const counts = await seedDemoData(prisma, { schema, log: console.log });

  console.log("\nSeed complete:", counts);
  console.log(`\nDemo accounts (password: ${DEMO_PASSWORD})`);
  console.log("  user1@example.com     driver with a live charging session");
  console.log("  admin@example.com     full admin dashboard");
  console.log("  operator@example.com  operator (read + station management)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
