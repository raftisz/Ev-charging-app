import "server-only";
import { prisma } from "@/server/db";
import type { SessionDTO } from "@/lib/types";

const DEFAULT_BATTERY_KWH = 64;
/** Average delivered power as a fraction of rated power (charge curve taper). */
const TAPER = 0.62;

const sessionInclude = {
  station: { select: { id: true, name: true, address: true } },
  charger: { select: { id: true, chargerCode: true, powerKw: true } },
  user: { select: { id: true, fullName: true, email: true, batteryKwh: true } },
} as const;

type SessionRecord = Awaited<
  ReturnType<
    typeof prisma.chargingSession.findFirstOrThrow<{ include: typeof sessionInclude }>
  >
>;

/**
 * An ACTIVE session keeps advancing after it is written, so its energy,
 * percent and cost are projected from elapsed wall-clock time on every read.
 * A finished session just reports its stored snapshot.
 */
export function projectSession(session: SessionRecord) {
  const battery = session.user?.batteryKwh ?? DEFAULT_BATTERY_KWH;
  const end = session.endTime ?? new Date();
  const minutesElapsed = Math.max(
    0,
    (end.getTime() - session.startTime.getTime()) / 60_000,
  );

  if (session.status !== "ACTIVE") {
    const remaining = Math.max(0, session.targetPercent - session.currentPercent);
    return {
      minutesElapsed: Math.round(minutesElapsed),
      minutesToTarget: Math.round((remaining / 100) * battery * 1.35),
      energyKwh: session.energyKwh,
      currentPercent: session.currentPercent,
      cost: session.cost,
    };
  }

  const headroomKwh = ((session.targetPercent - session.startPercent) / 100) * battery;
  const rawKwh = (session.powerKw * TAPER * minutesElapsed) / 60;
  const energyKwh = Math.min(headroomKwh, rawKwh);
  const currentPercent = Math.min(
    session.targetPercent,
    Math.round(session.startPercent + (energyKwh / battery) * 100),
  );
  const remainingKwh = Math.max(0, headroomKwh - energyKwh);
  const minutesToTarget = Math.round(
    (remainingKwh / Math.max(1, session.powerKw * TAPER)) * 60,
  );

  return {
    minutesElapsed: Math.round(minutesElapsed),
    minutesToTarget,
    energyKwh: Number(energyKwh.toFixed(2)),
    currentPercent,
    cost: Number((energyKwh * session.pricePerKwh).toFixed(2)),
  };
}

export function serializeSession(session: SessionRecord): SessionDTO {
  const live = projectSession(session);
  return {
    id: session.id,
    status: session.status,
    startTime: session.startTime.toISOString(),
    endTime: session.endTime?.toISOString() ?? null,
    startPercent: session.startPercent,
    currentPercent: live.currentPercent,
    targetPercent: session.targetPercent,
    energyKwh: live.energyKwh,
    powerKw: session.powerKw,
    pricePerKwh: session.pricePerKwh,
    cost: live.cost,
    paymentStatus: session.paymentStatus,
    paymentMethod: session.paymentMethod,
    minutesElapsed: live.minutesElapsed,
    minutesToTarget: live.minutesToTarget,
    station: session.station,
    charger: session.charger,
    user: session.user
      ? { id: session.user.id, fullName: session.user.fullName, email: session.user.email }
      : undefined,
  };
}

export const SESSION_INCLUDE = sessionInclude;

export async function getActiveSession(userId: number) {
  const session = await prisma.chargingSession.findFirst({
    where: { userId, status: "ACTIVE" },
    include: sessionInclude,
    orderBy: { startTime: "desc" },
  });
  return session ? serializeSession(session) : null;
}

export async function listSessions(where: object, take?: number) {
  const sessions = await prisma.chargingSession.findMany({
    where,
    include: sessionInclude,
    orderBy: { startTime: "desc" },
    take,
  });
  return sessions.map(serializeSession);
}
