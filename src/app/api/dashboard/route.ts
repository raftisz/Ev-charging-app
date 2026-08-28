import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handler, requireUser } from "@/server/http";
import { getDashboardStats } from "@/server/stats";
import { getActiveSession, listSessions } from "@/server/sessions";
import { recommendedStations } from "@/server/stations";
import { RESERVATION_INCLUDE, serializeReservation } from "@/server/reservations";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await requireUser();

  const [stats, activeSession, recommended, recentSessions, nextReservation, unread] =
    await Promise.all([
      getDashboardStats(user.id),
      getActiveSession(user.id),
      recommendedStations(user.id, 3),
      listSessions({ userId: user.id, status: { not: "ACTIVE" } }, 5),
      prisma.reservation.findFirst({
        where: {
          userId: user.id,
          status: { in: ["CONFIRMED", "PENDING"] },
          startTime: { gte: new Date() },
        },
        include: RESERVATION_INCLUDE,
        orderBy: { startTime: "asc" },
      }),
      prisma.notification.count({ where: { userId: user.id, isRead: false } }),
    ]);

  return NextResponse.json({
    stats,
    activeSession,
    recommended,
    recentSessions,
    nextReservation: nextReservation ? serializeReservation(nextReservation) : null,
    unreadNotifications: unread,
  });
});
