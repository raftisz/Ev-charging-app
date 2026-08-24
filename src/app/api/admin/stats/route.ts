import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handler, requireAdmin } from "@/lib/http";
import { getAdminStats } from "@/server/stats";
import { listSessions } from "@/server/sessions";
import { RESERVATION_INCLUDE, serializeReservation } from "@/server/reservations";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  await requireAdmin();

  const [stats, activeSessions, recentSessions, upcoming] = await Promise.all([
    getAdminStats(),
    listSessions({ status: "ACTIVE" }),
    listSessions({ status: { not: "ACTIVE" } }, 8),
    prisma.reservation.findMany({
      where: { status: "CONFIRMED", startTime: { gte: new Date() } },
      include: RESERVATION_INCLUDE,
      orderBy: { startTime: "asc" },
      take: 6,
    }),
  ]);

  return NextResponse.json({
    stats,
    activeSessions,
    recentSessions,
    upcomingReservations: upcoming.map(serializeReservation),
  });
});
