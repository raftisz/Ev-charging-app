import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { badRequest, conflict, handler, notFound, requireUser } from "@/server/http";
import { reservationSchema } from "@/lib/validation";
import {
  RESERVATION_INCLUDE,
  hasClash,
  serializeReservation,
} from "@/server/reservations";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope"); // upcoming | past | all
  const status = url.searchParams.get("status");
  const isStaff = user.role === "ADMIN" || user.role === "OPERATOR";
  const all = url.searchParams.get("all") === "true" && isStaff;

  const where: Prisma.ReservationWhereInput = all ? {} : { userId: user.id };
  if (status) where.status = status as Prisma.ReservationWhereInput["status"];
  if (scope === "upcoming") {
    where.startTime = { gte: new Date() };
    where.status = { in: ["PENDING", "CONFIRMED", "ACTIVE"] };
  }
  if (scope === "past") {
    where.OR = [
      { endTime: { lt: new Date() } },
      { status: { in: ["COMPLETED", "CANCELLED", "EXPIRED"] } },
    ];
  }

  const rows = await prisma.reservation.findMany({
    where,
    include: RESERVATION_INCLUDE,
    orderBy: { startTime: scope === "upcoming" ? "asc" : "desc" },
  });

  return NextResponse.json({ reservations: rows.map(serializeReservation) });
});

export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const body = reservationSchema.parse(await request.json());

  const charger = await prisma.charger.findUnique({
    where: { id: body.chargerId },
    include: { station: true },
  });
  if (!charger) throw notFound("That charger does not exist");
  if (charger.stationId !== body.stationId) {
    throw badRequest("That charger does not belong to the selected station");
  }
  if (charger.status === "OFFLINE" || charger.status === "MAINTENANCE") {
    throw conflict("That charger is out of service right now");
  }

  const start = new Date(body.startTime);
  if (Number.isNaN(start.getTime())) throw badRequest("Invalid start time");
  if (start.getTime() < Date.now() - 60_000) {
    throw badRequest("Pick a time in the future");
  }
  const end = new Date(start.getTime() + body.durationMinutes * 60_000);

  if (await hasClash(charger.id, start, end)) {
    throw conflict("That slot was just taken. Pick another time.");
  }

  const estimatedKwh = Number(
    (((body.durationMinutes / 60) * Math.min(charger.powerKw, 60)) * 0.62).toFixed(2),
  );
  const reservationFee = 20;

  const reservation = await prisma.reservation.create({
    data: {
      userId: user.id,
      stationId: charger.stationId,
      chargerId: charger.id,
      startTime: start,
      endTime: end,
      status: "CONFIRMED",
      estimatedKwh,
      reservationFee,
      estimatedCost: Number(
        (estimatedKwh * charger.station.pricePerKwh + reservationFee).toFixed(2),
      ),
      note: body.note || null,
    },
    include: RESERVATION_INCLUDE,
  });

  await prisma.charger.update({
    where: { id: charger.id },
    data: charger.status === "AVAILABLE" ? { status: "RESERVED" } : {},
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "RESERVATION",
      title: "Reservation confirmed",
      body: `${charger.station.name} · charger ${charger.chargerCode} is held for your slot.`,
    },
  });

  return NextResponse.json(
    { reservation: serializeReservation(reservation) },
    { status: 201 },
  );
});
