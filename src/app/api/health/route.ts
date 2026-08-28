import { NextResponse } from "next/server";
import { prisma } from "@/server/db";

/**
 * Deployment smoke test: is each piece configured and reachable? Reports
 * booleans and counts only — never the values of any environment variable.
 *
 *   curl https://your-app/api/health
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, unknown> = {
    databaseUrlSet: Boolean(process.env.DATABASE_URL),
    jwtSecretSet: Boolean(process.env.JWT_SECRET),
    databaseReachable: false,
    schemaApplied: false,
    seeded: false,
  };

  try {
    const stations = await prisma.station.count();
    checks.databaseReachable = true;
    checks.schemaApplied = true;
    checks.seeded = stations > 0;
    checks.stations = stations;
    checks.users = await prisma.user.count();
  } catch (error) {
    checks.error = error instanceof Error ? error.message.split("\n")[0] : "unknown";
  }

  const ok =
    checks.databaseUrlSet === true &&
    checks.jwtSecretSet === true &&
    checks.databaseReachable === true &&
    checks.seeded === true;

  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
