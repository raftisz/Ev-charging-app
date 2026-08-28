import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { startSession, verifyPassword } from "@/server/auth";
import { HttpError, forbidden, handler } from "@/server/http";
import { loginSchema } from "@/lib/validation";
import { serializeUser } from "@/server/users";

export const POST = handler(async (request: Request) => {
  const body = loginSchema.parse(await request.json());

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw new HttpError(401, "Email or password is incorrect");
  }
  if (!user.isActive) throw forbidden("This account has been disabled");

  await startSession({ userId: user.id, email: user.email, role: user.role });
  return NextResponse.json({ user: serializeUser(user) });
});
