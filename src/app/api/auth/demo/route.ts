import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { startSession } from "@/server/auth";
import { HttpError, forbidden, handler, notFound } from "@/server/http";
import { DEMO_LOGINS, isDemoModeEnabled } from "@/lib/demo";
import { serializeUser } from "@/server/users";

export const dynamic = "force-dynamic";

const demoSchema = z.object({
  as: z.enum(Object.keys(DEMO_LOGINS) as [keyof typeof DEMO_LOGINS]),
});

/** One-click sign-in to a seeded demo account, so visitors can try the app. */
export const POST = handler(async (request: Request) => {
  if (!isDemoModeEnabled()) throw notFound("Demo sign-in is turned off");
  const body = demoSchema.parse(await request.json().catch(() => ({})));

  const user = await prisma.user.findUnique({ where: { email: DEMO_LOGINS[body.as] } });
  if (!user) {
    throw new HttpError(503, "The demo data is being reset. Try again in a minute.");
  }
  if (!user.isActive) throw forbidden("This demo account is unavailable right now");

  await startSession({ userId: user.id, email: user.email, role: user.role });
  return NextResponse.json({ user: serializeUser(user) });
});
