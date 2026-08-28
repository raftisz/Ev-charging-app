import "server-only";
import { prisma } from "@/server/db";
import type { AdminStats, DashboardStats } from "@/lib/types";

/** grid-average kg CO2 avoided per kWh charged versus an equivalent ICE trip */
const CO2_PER_KWH = 0.27;

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function emptyDays(count: number) {
  const map = new Map<string, { kwh: number; revenue: number }>();
  for (let i = count - 1; i >= 0; i--) {
    map.set(dayKey(daysAgo(i)), { kwh: 0, revenue: 0 });
  }
  return map;
}

/** Per-driver dashboard figures. Every number comes from the database. */
export async function getDashboardStats(userId: number): Promise<DashboardStats> {
  const monthStart = startOfMonth();

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
    monthSpend: Math.round(monthSpend),
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
      where: { paymentStatus: { not: "FAILED" } },
    }),
    prisma.chargingSession.findMany({
      where: { startTime: { gte: daysAgo(29) }, paymentStatus: { not: "FAILED" } },
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
      revenue: Math.round(row._sum.cost ?? 0),
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
    revenue: Math.round(allSessions._sum.cost ?? 0),
    revenue30d: Math.round(revenue30dRows.reduce((s, r) => s + r.cost, 0)),
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
      revenue: Math.round(v.revenue),
      kwh: Number(v.kwh.toFixed(1)),
    })),
    topStations,
  };
}
