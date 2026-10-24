import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { startSession, verifyPassword } from "@/server/auth";
import { HttpError, forbidden, handler } from "@/server/http";
import { loginSchema } from "@/lib/validation";
import { serializeUser } from "@/server/users";
import { clear, clientIp, hit, retryAfter } from "@/server/rate-limit";
import { getLocale } from "@/i18n/server";
import { translateError } from "@/i18n/errors";

/** Wrong passwords allowed per account and address before a pause. */
const PER_ACCOUNT = 5;
/** Wrong passwords allowed per address across all accounts. */
const PER_ADDRESS = 20;
const WINDOW_MS = 15 * 60_000;

export const POST = handler(async (request: Request) => {
  const body = loginSchema.parse(await request.json());
  const ip = clientIp(request);
  const accountKey = `login:${ip}:${body.email}`;
  const addressKey = `login:${ip}`;

  const wait = Math.max(
    retryAfter(accountKey, PER_ACCOUNT),
    retryAfter(addressKey, PER_ADDRESS),
  );
  if (wait > 0) {
    return NextResponse.json(
      {
        error: translateError(
          await getLocale(),
          `Too many sign-in attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`,
        ),
        details: null,
      },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    hit(accountKey, WINDOW_MS);
    hit(addressKey, WINDOW_MS);
    throw new HttpError(401, "Email or password is incorrect");
  }
  if (!user.isActive) throw forbidden("This account has been disabled");

  clear(accountKey);
  await startSession({ userId: user.id, email: user.email, role: user.role });
  return NextResponse.json({ user: serializeUser(user) });
});
