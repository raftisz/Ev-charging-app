import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { hashPassword, startSession } from "@/server/auth";
import { conflict, handler } from "@/server/http";
import { registerSchema } from "@/lib/validation";
import { serializeUser } from "@/server/users";

export const POST = handler(async (request: Request) => {
  const body = registerSchema.parse(await request.json());

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw conflict("That email is already registered. Try signing in.");

  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash: await hashPassword(body.password),
      fullName: body.fullName,
      phone: body.phone || null,
      vehicleMake: body.vehicleMake || null,
      vehicleModel: body.vehicleModel || null,
      avatarInit: body.fullName
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
      walletBalance: 0,
    },
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "SYSTEM",
      title: "Welcome to Volt Grid",
      body: "Find a station, reserve a charger and track every session in one place.",
    },
  });

  await startSession({ userId: user.id, email: user.email, role: user.role });
  return NextResponse.json({ user: serializeUser(user) }, { status: 201 });
});
