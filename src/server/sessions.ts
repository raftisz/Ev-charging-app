import "server-only";
import { prisma } from "@/server/db";
import type { PaymentStatus, SessionDTO } from "@/lib/types";
import { minutesToReach, progressAt } from "@/lib/charge-curve";
import type { TracePoint } from "@/server/ocpp/metering";

/** A reading older than this means the charger has stopped reporting power. */
const STALE_METER_MS = 60_000;

const DEFAULT_BATTERY_KWH = 64;

const sessionInclude = {
  station: { select: { id: true, name: true, address: true } },
  charger: { select: { id: true, chargerCode: true, powerKw: true } },
  user: { select: { id: true, fullName: true, email: true, batteryKwh: true } },
  payments: {
    where: { type: "CHARGE", status: { in: ["PAID", "REFUNDED"] as PaymentStatus[] } },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} as const;

type SessionRecord = Awaited<
  ReturnType<
    typeof prisma.chargingSession.findFirstOrThrow<{ include: typeof sessionInclude }>
  >
>;

/**
 * An ACTIVE session keeps advancing after it is written, so its energy,
 * percent, power and cost are projected on every read from elapsed
 * wall-clock time along the charge curve in src/lib/charge-curve.ts. A
 * finished session just reports its stored snapshot.
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
      currentKw: 0,
      batteryKwh: battery,
    };
  }

  if (session.ocppIdTag) return projectMetered(session, battery, minutesElapsed);

  const curve = {
    ratedKw: session.powerKw,
    batteryKwh: battery,
    startPercent: session.startPercent,
    targetPercent: session.targetPercent,
  };
  const now = progressAt(curve, minutesElapsed);
  const minutesToTarget = Math.max(0, Math.round(minutesToReach(curve) - minutesElapsed));

  return {
    minutesElapsed: Math.round(minutesElapsed),
    minutesToTarget,
    energyKwh: Number(now.energyKwh.toFixed(2)),
    currentPercent: Math.min(session.targetPercent, Math.floor(now.soc + 1e-6)),
    cost: Number((now.energyKwh * session.pricePerKwh).toFixed(2)),
    currentKw: Number(now.kw.toFixed(1)),
    batteryKwh: battery,
  };
}

/**
 * An OCPP session reports what the charger's meter says: energy is the
 * register's rise since the start, power and state of charge are the latest
 * reading. Only the time to target is still estimated, from the curve.
 */
function projectMetered(session: SessionRecord, battery: number, minutesElapsed: number) {
  const energyKwh = Math.max(0, ((session.meterWh ?? 0) - (session.meterStartWh ?? session.meterWh ?? 0)) / 1000);
  const soc = session.meterSoc ?? Math.min(100, session.startPercent + (energyKwh / battery) * 100);
  const fresh = session.meterAt && Date.now() - session.meterAt.getTime() < STALE_METER_MS;
  const toTarget =
    soc >= session.targetPercent
      ? 0
      : minutesToReach({
          ratedKw: session.powerKw,
          batteryKwh: battery,
          startPercent: soc,
          targetPercent: session.targetPercent,
        });
  return {
    minutesElapsed: Math.round(session.ocppTransactionId ? minutesElapsed : 0),
    minutesToTarget: Math.round(toTarget),
    energyKwh: Number(energyKwh.toFixed(2)),
    currentPercent: Math.min(100, Math.floor(soc)),
    cost: Number((energyKwh * session.pricePerKwh).toFixed(2)),
    currentKw: fresh ? Number((session.meterKw ?? 0).toFixed(1)) : 0,
    batteryKwh: battery,
  };
}

function ocppInfo(session: SessionRecord): SessionDTO["ocpp"] {
  if (!session.ocppIdTag) return null;
  return {
    state: session.ocppTransactionId ? "charging" : "waiting",
    transactionId: session.ocppTransactionId,
    meteredAt: session.meterAt?.toISOString() ?? null,
    trace:
      session.status === "ACTIVE" && Array.isArray(session.meterTrace)
        ? (session.meterTrace as TracePoint[])
        : [],
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
    currentKw: live.currentKw,
    batteryKwh: live.batteryKwh,
    station: session.station,
    charger: session.charger,
    user: session.user
      ? { id: session.user.id, fullName: session.user.fullName, email: session.user.email }
      : undefined,
    receiptId: session.payments[0]?.id ?? null,
    ocpp: ocppInfo(session),
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
