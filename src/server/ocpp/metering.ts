/**
 * Session bookkeeping driven by a charger's own meter. Used by the CSMS
 * (ocpp/csms.ts, plain Node) and by the app's stop route, so it takes the
 * Prisma client as an argument and imports nothing that needs Next.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { toSatang } from "../../lib/payments";

type Db = Pick<PrismaClient, "chargingSession" | "charger" | "reservation" | "notification" | "$transaction">;

export type TracePoint = { m: number; kw: number; soc: number | null };

/** Keep the trace small enough to send every few seconds. */
const MAX_TRACE = 240;

export type MeterReading = {
  /** Energy register in Wh. */
  wh?: number;
  /** Active power in kW. */
  kw?: number;
  /** Battery state of charge, percent. */
  soc?: number;
  at: Date;
};

/** Store the latest reading on an active OCPP session and add it to the trace. */
export async function applyMeterReading(db: Db, transactionId: number, reading: MeterReading) {
  const session = await db.chargingSession.findFirst({
    where: { ocppTransactionId: transactionId, status: "ACTIVE" },
    select: { id: true, startTime: true, meterTrace: true, meterSoc: true, meterWh: true, targetPercent: true },
  });
  if (!session) return null;

  const soc = reading.soc === undefined ? session.meterSoc : Math.round(reading.soc);
  const trace = Array.isArray(session.meterTrace) ? (session.meterTrace as TracePoint[]) : [];
  if (reading.kw !== undefined) {
    const m = Math.max(0, (reading.at.getTime() - session.startTime.getTime()) / 60_000);
    trace.push({ m: Number(m.toFixed(2)), kw: Number(reading.kw.toFixed(2)), soc: soc ?? null });
  }
  // Thin the oldest half rather than dropping it, so the chart keeps its shape.
  const thinned =
    trace.length > MAX_TRACE
      ? [...trace.slice(0, MAX_TRACE / 2).filter((_, i) => i % 2 === 0), ...trace.slice(MAX_TRACE / 2)]
      : trace;

  await db.chargingSession.update({
    where: { id: session.id },
    data: {
      meterWh: reading.wh === undefined ? undefined : Math.round(reading.wh),
      meterKw: reading.kw,
      meterSoc: soc ?? undefined,
      meterAt: reading.at,
      meterTrace: thinned,
    },
  });
  return { sessionId: session.id, soc, targetPercent: session.targetPercent };
}

/**
 * Close an OCPP session from its meter: energy is the register at the end
 * minus the register at the start, billed at the session's price. Safe to
 * call twice (the app and the CSMS can both get there); only the first
 * call changes anything. Returns the session id if this call closed it.
 */
export async function finishMeteredSession(
  db: Db,
  sessionId: number,
  end: { meterStopWh?: number | null; at?: Date; reason?: string },
) {
  return db.$transaction(async (tx) => {
    const session = await tx.chargingSession.findUnique({
      where: { id: sessionId },
      include: { station: { select: { name: true } }, user: { select: { batteryKwh: true } } },
    });
    if (!session || session.status !== "ACTIVE") return null;

    const startWh = session.meterStartWh ?? 0;
    const stopWh = end.meterStopWh ?? session.meterWh ?? startWh;
    const energyKwh = Math.max(0, (stopWh - startWh) / 1000);
    const battery = session.user.batteryKwh ?? 64;
    const percent =
      session.meterSoc ?? Math.min(100, Math.floor(session.startPercent + (energyKwh / battery) * 100));
    const endTime = end.at ?? new Date();

    const claimed = await tx.chargingSession.updateMany({
      where: { id: session.id, status: "ACTIVE" },
      data: {
        status: end.reason === "EmergencyStop" || end.reason === "PowerLoss" ? "FAULTED" : "COMPLETED",
        endTime,
        meterWh: stopWh,
        meterKw: 0,
        energyKwh: Number(energyKwh.toFixed(3)),
        currentPercent: percent,
        cost: toSatang(energyKwh * session.pricePerKwh),
      },
    });
    if (claimed.count === 0) return null;

    await tx.charger.update({ where: { id: session.chargerId }, data: { status: "AVAILABLE" } });
    if (session.reservationId) {
      await tx.reservation.update({ where: { id: session.reservationId }, data: { status: "COMPLETED" } });
    }
    const minutes = Math.round((endTime.getTime() - session.startTime.getTime()) / 60_000);
    await tx.notification.create({
      data: {
        userId: session.userId,
        type: "SESSION",
        title: "Session complete",
        body: `${session.station.name} · ${energyKwh.toFixed(1)} kWh delivered in ${minutes} minutes.`,
      },
    });
    return session.id;
  });
}
