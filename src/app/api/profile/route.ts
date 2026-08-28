import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { hashPassword } from "@/server/auth";
import { handler, requireUser } from "@/server/http";
import { profileSchema } from "@/lib/validation";
import { serializeUser } from "@/server/users";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireUser();
  return NextResponse.json({ user: serializeUser(user) });
});

export const PATCH = handler(async (request: Request) => {
  const user = await requireUser();
  const body = profileSchema.parse(await request.json());

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName: body.fullName ?? undefined,
      phone: body.phone !== undefined ? body.phone || null : undefined,
      vehicleMake: body.vehicleMake !== undefined ? body.vehicleMake || null : undefined,
      vehicleModel: body.vehicleModel !== undefined ? body.vehicleModel || null : undefined,
      vehiclePlate: body.vehiclePlate !== undefined ? body.vehiclePlate || null : undefined,
      batteryKwh: body.batteryKwh ?? undefined,
      passwordHash: body.password ? await hashPassword(body.password) : undefined,
    },
  });

  return NextResponse.json({ user: serializeUser(updated) });
});
