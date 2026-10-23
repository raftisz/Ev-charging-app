import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import {
  badRequest,
  conflict,
  enumParam,
  handler,
  intParam,
  notFound,
  requireUser,
} from "@/server/http";
import { lockCharger, lockUser } from "@/server/locks";
import { startSessionSchema } from "@/lib/validation";
import { SESSION_INCLUDE, listSessions, serializeSession } from "@/server/sessions";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export const GET = handler(async (request: Request) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const isStaff = user.role === "ADMIN" || user.role === "OPERATOR";
  const all = url.searchParams.get("all") === "true" && isStaff;
  const status = enumParam(
    url.searchParams.get("status"),
    ["ACTIVE", "COMPLETED", "STOPPED", "FAULTED"] as const,
    "status",
  );
  const take = intParam(url.searchParams.get("limit"), 1, 500, "limit");

  const where: Prisma.ChargingSessionWhereInput = all ? {} : { userId: user.id };
  if (status) where.status = status;

  const sessions = await listSessions(where, take);
  return NextResponse.json({ sessions });
});

/** How early a driver may plug in for their own reservation. */
const EARLY_START_MS = 15 * 60_000;

/**
 * Start charging on a charger the driver is standing at.
 *
 * Every check and the claim on the charger happen inside one transaction
 * that holds an advisory lock on the charger and on the driver, so two
 * drivers pressing Start together cannot both get the charger, and one
 * driver cannot open two sessions from two tabs.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const body = startSessionSchema.parse(await request.json());
  if (body.targetPercent <= body.startPercent) {
    throw conflict("Target charge must be above the current battery level");
  }

  const { session, charger } = await prisma.$transaction(async (tx) => {
    await lockCharger(tx, body.chargerId);
    await lockUser(tx, user.id);

    const existing = await tx.chargingSession.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
    });
    if (existing) throw conflict("You already have a charging session running");

    const charger = await tx.charger.findUnique({
      where: { id: body.chargerId },
      include: { station: true },
    });
    if (!charger) throw notFound("That charger does not exist");
    if (charger.stationId !== body.stationId) {
      throw badRequest("That charger does not belong to the selected station");
    }
    if (charger.status === "CHARGING") throw conflict("That charger is already in use");
    if (charger.status === "OFFLINE" || charger.status === "MAINTENANCE") {
      throw conflict("That charger is out of service right now");
    }

    const now = new Date();
    if (body.reservationId) {
      const own = await tx.reservation.findFirst({
        where: { id: body.reservationId, userId: user.id },
      });
      if (!own) throw notFound("That reservation does not exist");
      if (own.chargerId !== charger.id) {
        throw badRequest("That reservation is for a different charger");
      }
      if (own.status !== "CONFIRMED") throw conflict("That reservation can no longer be used");
      if (own.startTime.getTime() - EARLY_START_MS > now.getTime() || own.endTime <= now) {
        throw conflict("Your reservation is not open yet. You can start 15 minutes before it.");
      }
    }

    // Someone else's booking that covers right now keeps the charger for them.
    const heldForOther = await tx.reservation.findFirst({
      where: {
        chargerId: charger.id,
        userId: { not: user.id },
        status: { in: ["CONFIRMED", "ACTIVE"] },
        startTime: { lt: new Date(now.getTime() + EARLY_START_MS) },
        endTime: { gt: now },
      },
    });
    if (heldForOther) throw conflict("That charger is reserved for another driver right now");

    await tx.charger.update({
      where: { id: charger.id },
      data: { status: "CHARGING" },
    });
    if (body.reservationId) {
      await tx.reservation.update({
        where: { id: body.reservationId },
        data: { status: "ACTIVE" },
      });
    }
    const session = await tx.chargingSession.create({
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
    return { session, charger };
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
