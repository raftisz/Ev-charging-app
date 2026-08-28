import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { conflict, handler, notFound, requireUser } from "@/server/http";
import { startSessionSchema } from "@/lib/validation";
import { SESSION_INCLUDE, listSessions, serializeSession } from "@/server/sessions";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const isStaff = user.role === "ADMIN" || user.role === "OPERATOR";
  const all = url.searchParams.get("all") === "true" && isStaff;
  const status = url.searchParams.get("status");
  const take = url.searchParams.get("limit")
    ? Number(url.searchParams.get("limit"))
    : undefined;

  const where: Prisma.ChargingSessionWhereInput = all ? {} : { userId: user.id };
  if (status) where.status = status as Prisma.ChargingSessionWhereInput["status"];

  const sessions = await listSessions(where, take);
  return NextResponse.json({ sessions });
});

/** Start charging on a charger the driver is standing at. */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const body = startSessionSchema.parse(await request.json());

  const existing = await prisma.chargingSession.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
  });
  if (existing) throw conflict("You already have a charging session running");

  const charger = await prisma.charger.findUnique({
    where: { id: body.chargerId },
    include: { station: true },
  });
  if (!charger) throw notFound("That charger does not exist");
  if (charger.status === "CHARGING") throw conflict("That charger is already in use");
  if (charger.status === "OFFLINE" || charger.status === "MAINTENANCE") {
    throw conflict("That charger is out of service right now");
  }
  if (body.targetPercent <= body.startPercent) {
    throw conflict("Target charge must be above the current battery level");
  }

  const session = await prisma.$transaction(async (tx) => {
    await tx.charger.update({
      where: { id: charger.id },
      data: { status: "CHARGING" },
    });
    if (body.reservationId) {
      await tx.reservation.updateMany({
        where: { id: body.reservationId, userId: user.id },
        data: { status: "ACTIVE" },
      });
    }
    return tx.chargingSession.create({
      data: {
        userId: user.id,
        stationId: charger.stationId,
        chargerId: charger.id,
        reservationId: body.reservationId,
        status: "ACTIVE",
        startPercent: body.startPercent,
        currentPercent: body.startPercent,
        targetPercent: body.targetPercent,
        powerKw: charger.powerKw,
        pricePerKwh: charger.station.pricePerKwh,
      },
      include: SESSION_INCLUDE,
    });
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "SESSION",
      title: "Charging started",
      body: `${charger.station.name} · charger ${charger.chargerCode} is delivering ${Math.round(charger.powerKw)} kW.`,
    },
  });

  return NextResponse.json({ session: serializeSession(session) }, { status: 201 });
});
