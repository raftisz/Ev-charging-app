import "server-only";
import { prisma } from "@/server/db";
import { toSatang } from "@/lib/payments";
import { APP_TIME_ZONE, bangkokDay, bangkokDaysAgo, lastBangkokDays } from "@/lib/timezone";
import type { AnalyticsDTO, PowerClass } from "@/lib/types";

/**
 * Network analytics for the admin console. Sessions in the period are
 * loaded once and aggregated here rather than in SQL, so every grouping
 * (Bangkok day, Bangkok hour of the week) uses the same time-zone helpers as
 * the rest of the app. A demo network has a few hundred sessions a month;
 * a large one would move these groupings into the database.
 */

export const ANALYTICS_PERIODS = [7, 30, 90] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

/** Sessions that were billed: everything except refunds and failed payments. */
const BILLED = new Set(["PAID", "PENDING"]);

const HOUR_PARTS = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
});
const WEEKDAY: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/** Monday-first weekday and hour in Bangkok. */
function weekHour(date: Date) {
  const parts: Record<string, string> = {};
  for (const p of HOUR_PARTS.formatToParts(date)) parts[p.type] = p.value;
  return { day: WEEKDAY[parts.weekday] ?? 0, hour: Number(parts.hour) % 24 };
}

export function powerClass(kw: number): PowerClass {
  if (kw >= 100) return "fast";
  if (kw >= 50) return "dc";
  return "ac";
}

type Row = {
  startTime: Date;
  endTime: Date | null;
  status: string;
  energyKwh: number;
  cost: number;
  paymentStatus: string;
  userId: number;
  stationId: number;
  charger: { powerKw: number };
};

function minutesOf(row: Row, now: Date) {
  const end = row.endTime ?? now;
  return Math.max(0, (end.getTime() - row.startTime.getTime()) / 60_000);
}

function totals(rows: Row[], chargers: number, periodMinutes: number, now: Date) {
  const done = rows.filter((r) => r.status !== "ACTIVE");
  const energy = done.reduce((s, r) => s + r.energyKwh, 0);
  const revenue = done.filter((r) => BILLED.has(r.paymentStatus)).reduce((s, r) => s + r.cost, 0);
  const minutes = rows.reduce((s, r) => s + minutesOf(r, now), 0);
  return {
    sessions: done.length,
    energyKwh: Number(energy.toFixed(1)),
    revenue: toSatang(revenue),
    avgKwh: done.length ? Number((energy / done.length).toFixed(1)) : 0,
    avgMinutes: done.length
      ? Math.round(done.reduce((s, r) => s + minutesOf(r, now), 0) / done.length)
      : 0,
    avgRevenue: done.length ? toSatang(revenue / done.length) : 0,
    drivers: new Set(rows.map((r) => r.userId)).size,
    utilisation: chargers ? Number(((minutes / (chargers * periodMinutes)) * 100).toFixed(1)) : 0,
  };
}

const SELECT = {
  startTime: true,
  endTime: true,
  status: true,
  energyKwh: true,
  cost: true,
  paymentStatus: true,
  userId: true,
  stationId: true,
  charger: { select: { powerKw: true } },
} as const;

export async function getAnalytics(days: AnalyticsPeriod): Promise<AnalyticsDTO> {
  const now = new Date();
  const from = bangkokDaysAgo(days - 1, now);
  const previousFrom = bangkokDaysAgo(days * 2 - 1, now);
  const periodMinutes = (now.getTime() - from.getTime()) / 60_000;

  const [rows, previousRows, stations, chargerCount, payments] = await Promise.all([
    prisma.chargingSession.findMany({ where: { startTime: { gte: from } }, select: SELECT }),
    prisma.chargingSession.findMany({
      where: { startTime: { gte: previousFrom, lt: from } },
      select: SELECT,
    }),
    prisma.station.findMany({
      select: { id: true, name: true, _count: { select: { chargers: true } } },
    }),
    prisma.charger.count(),
    prisma.payment.groupBy({
      by: ["method"],
      where: { type: "CHARGE", status: "PAID", createdAt: { gte: from } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ]);

  const current = totals(rows, chargerCount, periodMinutes, now);
  const previous = totals(previousRows, chargerCount, days * 24 * 60, from);

  const daily = new Map(
    lastBangkokDays(days, now).map((day) => [day, { sessions: 0, energyKwh: 0, revenue: 0 }]),
  );
  const heatmap = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const byStation = new Map<number, { sessions: number; energyKwh: number; revenue: number; minutes: number }>();
  const byClass = new Map<PowerClass, { sessions: number; energyKwh: number }>([
    ["ac", { sessions: 0, energyKwh: 0 }],
    ["dc", { sessions: 0, energyKwh: 0 }],
    ["fast", { sessions: 0, energyKwh: 0 }],
  ]);

  for (const row of rows) {
    const billed = row.status !== "ACTIVE" && BILLED.has(row.paymentStatus);
    const day = daily.get(bangkokDay(row.startTime));
    if (day) {
      day.sessions += 1;
      day.energyKwh += row.energyKwh;
      if (billed) day.revenue += row.cost;
    }
    const { day: weekday, hour } = weekHour(row.startTime);
    heatmap[weekday][hour] += 1;

    const station = byStation.get(row.stationId) ?? { sessions: 0, energyKwh: 0, revenue: 0, minutes: 0 };
    station.sessions += 1;
    station.energyKwh += row.energyKwh;
    station.minutes += minutesOf(row, now);
    if (billed) station.revenue += row.cost;
    byStation.set(row.stationId, station);

    const cls = byClass.get(powerClass(row.charger.powerKw))!;
    cls.sessions += 1;
    cls.energyKwh += row.energyKwh;
  }

  return {
    days,
    from: from.toISOString(),
    to: now.toISOString(),
    totals: current,
    previous,
    daily: [...daily.entries()].map(([date, v]) => ({
      date,
      sessions: v.sessions,
      energyKwh: Number(v.energyKwh.toFixed(1)),
      revenue: toSatang(v.revenue),
    })),
    heatmap,
    stations: stations
      .map((s) => {
        const agg = byStation.get(s.id) ?? { sessions: 0, energyKwh: 0, revenue: 0, minutes: 0 };
        const capacity = s._count.chargers * periodMinutes;
        return {
          id: s.id,
          name: s.name,
          chargers: s._count.chargers,
          sessions: agg.sessions,
          energyKwh: Number(agg.energyKwh.toFixed(1)),
          revenue: toSatang(agg.revenue),
          utilisation: capacity ? Number(((agg.minutes / capacity) * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue || b.sessions - a.sessions),
    powerClasses: [...byClass.entries()].map(([key, v]) => ({
      key,
      sessions: v.sessions,
      energyKwh: Number(v.energyKwh.toFixed(1)),
    })),
    paymentMethods: payments
      .map((p) => ({ method: p.method, count: p._count._all, amount: toSatang(p._sum.amount ?? 0) }))
      .sort((a, b) => b.amount - a.amount),
  };
}
