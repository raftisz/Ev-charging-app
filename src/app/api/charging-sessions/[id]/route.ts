import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { badRequest, conflict, forbidden, handler, notFound, requireUser } from "@/server/http";
import { paySessionSchema } from "@/lib/validation";
import { PAYMENT_METHOD_LABEL, toSatang } from "@/lib/payments";
import { SESSION_INCLUDE, projectSession, serializeSession } from "@/server/sessions";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function load(ctx: Params, userId: number, isStaff: boolean) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) throw badRequest("Invalid session id");
  const session = await prisma.chargingSession.findUnique({
    where: { id },
    include: SESSION_INCLUDE,
  });
  if (!session) throw notFound("That charging session does not exist");
  if (session.userId !== userId && !isStaff) {
    throw forbidden("That session belongs to another driver");
  }
  return session;
}

export const GET = handler(async (_r: Request, ctx: Params) => {
  const user = await requireUser();
  const isStaff = user.role === "ADMIN" || user.role === "OPERATOR";
  return NextResponse.json({
    session: serializeSession(await load(ctx, user.id, isStaff)),
  });
});

/**
 * action=stop  freezes the projected values and frees the charger.
 * action=pay   settles the session against the chosen payment method.
 */
export const PATCH = handler(async (request: Request, ctx: Params) => {
  const user = await requireUser();
  const isStaff = user.role === "ADMIN" || user.role === "OPERATOR";
  const session = await load(ctx, user.id, isStaff);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = (body.action as string) ?? "stop";

  if (action === "stop") {
    if (session.status !== "ACTIVE") throw conflict("That session has already finished");
    const live = projectSession(session);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.charger.update({
        where: { id: session.chargerId },
        data: { status: "AVAILABLE" },
      });
      if (session.reservationId) {
        await tx.reservation.update({
          where: { id: session.reservationId },
          data: { status: "COMPLETED" },
        });
      }
      return tx.chargingSession.update({
        where: { id: session.id },
        data: {
          status: "COMPLETED",
          endTime: new Date(),
          energyKwh: live.energyKwh,
          currentPercent: live.currentPercent,
          cost: live.cost,
        },
        include: SESSION_INCLUDE,
      });
    });

    await prisma.notification.create({
      data: {
        userId: session.userId,
        type: "SESSION",
        title: "Session complete",
        body: `${session.station.name} · ${live.energyKwh.toFixed(1)} kWh delivered in ${live.minutesElapsed} minutes.`,
      },
    });

    return NextResponse.json({ session: serializeSession(updated) });
  }

  if (action === "pay") {
    if (session.status === "ACTIVE") throw conflict("Stop the session before paying");
    if (session.paymentStatus === "PAID") throw conflict("This session is already paid");
    const { paymentMethod: method } = paySessionSchema.parse(body);
    const label = PAYMENT_METHOD_LABEL[method];
    const total = toSatang(session.cost);

    // Both writes below are conditional, so two concurrent requests cannot
    // both settle the session and the wallet cannot be taken below zero.
    // Either one fails and the whole transaction rolls back.
    const updated = await prisma.$transaction(async (tx) => {
      const claimed = await tx.chargingSession.updateMany({
        where: { id: session.id, status: { not: "ACTIVE" }, paymentStatus: { not: "PAID" } },
        data: { paymentStatus: "PAID", paymentMethod: label },
      });
      if (claimed.count === 0) throw conflict("This session is already paid");

      if (method === "WALLET") {
        const debited = await tx.user.updateMany({
          where: { id: session.userId, walletBalance: { gte: total } },
          data: { walletBalance: { decrement: total } },
        });
        if (debited.count === 0) {
          throw conflict("Not enough wallet balance. Top up or use another method.");
        }
      }

      await tx.payment.create({
        data: {
          sessionId: session.id,
          userId: session.userId,
          type: "CHARGE",
          amount: total,
          method,
          status: "PAID",
        },
      });

      return tx.chargingSession.findUniqueOrThrow({
        where: { id: session.id },
        include: SESSION_INCLUDE,
      });
    });

    await prisma.notification.create({
      data: {
        userId: session.userId,
        type: "PAYMENT",
        title: "Payment received",
        body: `฿${Math.round(total)} paid with ${label} for session #${session.id}.`,
      },
    });

    return NextResponse.json({ session: serializeSession(updated) });
  }

  throw badRequest("Unknown action. Use 'stop' or 'pay'.");
});

export const DELETE = handler(async (_r: Request, ctx: Params) => {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw forbidden("Admin access only");
  const session = await load(ctx, user.id, true);
  await prisma.chargingSession.delete({ where: { id: session.id } });
  return NextResponse.json({ ok: true });
});
