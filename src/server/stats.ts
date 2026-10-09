import "server-only";
import { prisma } from "@/server/db";
import type { AdminStats, DashboardStats } from "@/lib/types";
import { toSatang } from "@/lib/payments";
import { bangkokDay, bangkokDaysAgo, lastBangkokDays, startOfBangkokMonth } from "@/lib/timezone";

/** grid-average kg CO2 avoided per kWh charged versus an equivalent ICE trip */
const CO2_PER_KWH = 0.27;

// Days and months are Bangkok days and months, not the server's (UTC on
// Vercel), so a session at 01:00 in Bangkok counts towards that day.
const daysAgo = (n: number) => bangkokDaysAgo(n);
const dayKey = (d: Date) => bangkokDay(d);

function emptyDays(count: number) {
  const map = new Map<string, { kwh: number; revenue: number }>();
  for (const day of lastBangkokDays(count)) map.set(day, { kwh: 0, revenue: 0 });
  return map;
}

/** Per-driver dashboard figures. Every number comes from the database. */
export async function getDashboardStats(userId: number): Promise<DashboardStats> {
  const monthStart = startOfBangkokMonth();

  const [
    totalStations,
    openStations,
    totalChargers,
    availableChargers,
    activeSessions,
    fastSites,
    upcomingReservations,
    monthSessions,
    dayRows,
  ] = await Promise.all([
    prisma.station.count(),
    prisma.station.count({ where: { status: { in: ["AVAILABLE", "BUSY"] } } }),
    prisma.charger.count(),
    prisma.charger.count({ where: { status: "AVAILABLE" } }),
    prisma.chargingSession.count({ where: { status: "ACTIVE" } }),
    prisma.station.count({ where: { chargers: { some: { powerKw: { gte: 100 } } } } }),
    prisma.reservation.count({
      where: { userId, status: "CONFIRMED", startTime: { gte: new Date() } },
    }),
    prisma.chargingSession.findMany({
      where: { userId, startTime: { gte: monthStart } },
      select: { energyKwh: true, cost: true },
    }),
    prisma.chargingSession.findMany({
      where: { userId, startTime: { gte: daysAgo(13) } },
      select: { startTime: true, energyKwh: true },
    }),
  ]);

  const monthEnergyKwh = monthSessions.reduce((sum, s) => sum + s.energyKwh, 0);
  const monthSpend = monthSessions.reduce((sum, s) => sum + s.cost, 0);

  const buckets = emptyDays(14);
  for (const row of dayRows) {
    const key = dayKey(row.startTime);
    const bucket = buckets.get(key);
    if (bucket) bucket.kwh += row.energyKwh;
  }

  return {
    totalStations,
    openStations,
    totalChargers,
    availableChargers,
    activeSessions,
    utilization: totalChargers
      ? Math.round(((totalChargers - availableChargers) / totalChargers) * 100)
      : 0,
    monthEnergyKwh: Number(monthEnergyKwh.toFixed(1)),
    monthSpend: toSatang(monthSpend),
    monthSessions: monthSessions.length,
    co2SavedKg: Math.round(monthEnergyKwh * CO2_PER_KWH),
    upcomingReservations,
    fastSites,
    dailyEnergy: [...buckets.entries()].map(([date, v]) => ({
      date,
      kwh: Number(v.kwh.toFixed(1)),
    })),
  };
}

/** Network-wide figures for the admin dashboard. */
export async function getAdminStats(): Promise<AdminStats> {
  const [
    totalStations,
    totalChargers,
    availableChargers,
    activeSessions,
    totalUsers,
    activeUsers,
    allSessions,
    revenue30dRows,
    reservations,
    upcomingReservations,
    stationGroups,
    chargerGroups,
    topStationRows,
    stationNames,
  ] = await Promise.all([
    prisma.station.count(),
    prisma.charger.count(),
    prisma.charger.count({ where: { status: "AVAILABLE" } }),
    prisma.chargingSession.count({ where: { status: "ACTIVE" } }),
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.chargingSession.aggregate({
      _sum: { energyKwh: true, cost: true },
      where: { paymentStatus: { in: ["PAID", "PENDING"] } },
    }),
    prisma.chargingSession.findMany({
      where: { startTime: { gte: daysAgo(29) }, paymentStatus: { in: ["PAID", "PENDING"] } },
      select: { startTime: true, cost: true, energyKwh: true },
    }),
    prisma.reservation.count(),
    prisma.reservation.count({
      where: { status: "CONFIRMED", startTime: { gte: new Date() } },
    }),
    prisma.station.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.charger.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.chargingSession.groupBy({
      by: ["stationId"],
      _count: { _all: true },
      _sum: { cost: true },
    }),
    prisma.station.findMany({ select: { id: true, name: true } }),
  ]);

  const buckets = emptyDays(30);
  for (const row of revenue30dRows) {
    const bucket = buckets.get(dayKey(row.startTime));
    if (bucket) {
      bucket.revenue += row.cost;
      bucket.kwh += row.energyKwh;
    }
  }

  const nameById = new Map(stationNames.map((s) => [s.id, s.name]));
  const topStations = topStationRows
    .map((row) => ({
      id: row.stationId,
      name: nameById.get(row.stationId) ?? `Station ${row.stationId}`,
      sessions: row._count._all,
      revenue: toSatang(row._sum.cost ?? 0),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    totalStations,
    totalChargers,
    availableChargers,
    activeSessions,
    totalUsers,
    activeUsers,
    totalEnergyKwh: Number((allSessions._sum.energyKwh ?? 0).toFixed(1)),
    revenue: toSatang(allSessions._sum.cost ?? 0),
    revenue30d: toSatang(revenue30dRows.reduce((s, r) => s + r.cost, 0)),
    reservations,
    upcomingReservations,
    utilization: totalChargers
      ? Math.round(((totalChargers - availableChargers) / totalChargers) * 100)
      : 0,
    statusBreakdown: stationGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
    })),
    chargerBreakdown: chargerGroups.map((g) => ({
      status: g.status,
      count: g._count._all,
    })),
    revenueByDay: [...buckets.entries()].map(([date, v]) => ({
      date,
      revenue: toSatang(v.revenue),
      kwh: Number(v.kwh.toFixed(1)),
    })),
    topStations,
  };
}
