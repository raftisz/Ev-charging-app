import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { ConfigError, handler, notFound, unauthorized } from "@/server/http";
import { parseDatabaseUrl, requireDatabaseUrl } from "@/server/env";
import { isDemoModeEnabled } from "@/lib/demo";
import { seedDemoData } from "../../../../../prisma/demo-data";

export const dynamic = "force-dynamic";
// Reseeding writes a few hundred rows; give it room on serverless hosts.
export const maxDuration = 60;

function authorised(request: Request, secret: string) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Puts the public demo back to its starting state. Vercel Cron calls this
 * once a day (see vercel.json) and sends CRON_SECRET as a bearer token;
 * any other caller gets 401.
 */
export const GET = handler(async (request: Request) => {
  if (!isDemoModeEnabled()) throw notFound("Demo mode is turned off");
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new ConfigError("CRON_SECRET is not set, so the demo cannot be reset.");
  if (!authorised(request, secret)) throw unauthorized("Not allowed");

  const started = Date.now();
  const { schema } = parseDatabaseUrl(requireDatabaseUrl());
  const counts = await seedDemoData(prisma, { schema });
  return NextResponse.json({ ok: true, counts, ms: Date.now() - started });
});
