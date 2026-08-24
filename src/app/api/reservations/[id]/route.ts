import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, forbidden, handler, notFound, requireUser } from "@/lib/http";
import { RESERVATION_INCLUDE, serializeReservation } from "@/server/reservations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function load(ctx: Params, userId: number, isStaff: boolean) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) throw badRequest("Invalid reservation id");
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: RESERVATION_INCLUDE,
  });
  if (!reservation) throw notFound("That reservation does not exist");
  if (reservation.userId !== userId && !isStaff) {
    throw forbidden("That reservation belongs to another driver");
  }
  return reservation;
}

export const GET = handler(async (_r: Request, ctx: Params) => {
  const user = await requireUser();
  const isStaff = user.role === "ADMIN" || user.role === "OPERATOR";
  const reservation = await load(ctx, user.id, isStaff);
  return NextResponse.json({ reservation: serializeReservation(reservation) });
});

/** Cancel (status: CANCELLED) or, for staff, move to any other status. */
export const PATCH = handler(async (request: Request, ctx: Params) => {
  const user = await requireUser();
  const isStaff = user.role === "ADMIN" || user.role === "OPERATOR";
  const reservation = await load(ctx, user.id, isStaff);

  const body = (await request.json().catch(() => ({}))) as { status?: string };
  const next = body.status ?? "CANCELLED";

  if (!isStaff && next !== "CANCELLED") {
    throw forbidden("You can only cancel your own reservation");
  }
  if (next === "CANCELLED" && reservation.status === "COMPLETED") {
    throw conflict("That reservation has already been completed");
  }
  if (next === "CANCELLED" && reservation.status === "CANCELLED") {
    throw conflict("That reservation is already cancelled");
  }

  const updated = await prisma.reservation.update({
    where: { id: reservation.id },
    data: { status: next as typeof reservation.status },
    include: RESERVATION_INCLUDE,
  });

  if (next === "CANCELLED") {
    const stillHeld = await prisma.reservation.count({
      where: {
        chargerId: reservation.chargerId,
        status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
      },
    });
    const charger = await prisma.charger.findUnique({ where: { id: reservation.chargerId } });
    if (!stillHeld && charger?.status === "RESERVED") {
      await prisma.charger.update({
        where: { id: reservation.chargerId },
        data: { status: "AVAILABLE" },
      });
    }
    await prisma.notification.create({
      data: {
        userId: reservation.userId,
        type: "RESERVATION",
        title: "Reservation cancelled",
        body: `${reservation.station.name} · charger ${reservation.charger.chargerCode} has been released.`,
      },
    });
  }

  return NextResponse.json({ reservation: serializeReservation(updated) });
});

export const DELETE = handler(async (_r: Request, ctx: Params) => {
  const user = await requireUser();
  const isStaff = user.role === "ADMIN" || user.role === "OPERATOR";
  const reservation = await load(ctx, user.id, isStaff);
  await prisma.reservation.delete({ where: { id: reservation.id } });
  return NextResponse.json({ ok: true });
});
