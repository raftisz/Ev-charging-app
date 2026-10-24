/**
 * What the CSMS does with each message a charge point sends. Each handler
 * gets the charger the connection belongs to and returns the CALLRESULT
 * payload, or throws OcppError for a CALLERROR.
 */
import type { PrismaClient } from "../src/generated/prisma/client";
import type { ChargerStatus } from "../src/generated/prisma/enums";
import { HEARTBEAT_INTERVAL_S, parseIdTag } from "../src/lib/ocpp";
import { applyMeterReading, finishMeteredSession } from "../src/server/ocpp/metering";
import {
  Authorize,
  BootNotification,
  DataTransfer,
  Heartbeat,
  MeterValues,
  OcppError,
  StartTransaction,
  StatusNotification,
  StopTransaction,
  parsePayload,
  readMeterValue,
  type ChargePointStatus,
} from "./protocol";

export type ChargePoint = { id: number; identity: string };

export type HandlerContext = {
  db: PrismaClient;
  chargePoint: ChargePoint;
  /** Send a command back to this charge point (used to stop at the target). */
  send: (action: string, payload: object) => Promise<Record<string, unknown>>;
  log?: (message: string) => void;
};

type Handler = (ctx: HandlerContext, payload: unknown) => Promise<object>;

/** How OCPP connector states map onto the app's charger states. */
const STATUS_MAP: Record<ChargePointStatus, ChargerStatus> = {
  Available: "AVAILABLE",
  Preparing: "CHARGING",
  Charging: "CHARGING",
  SuspendedEVSE: "CHARGING",
  SuspendedEV: "CHARGING",
  Finishing: "CHARGING",
  Reserved: "RESERVED",
  Unavailable: "MAINTENANCE",
  Faulted: "OFFLINE",
};

const accepted = { idTagInfo: { status: "Accepted" } } as const;
const invalid = { idTagInfo: { status: "Invalid" } } as const;

/** The active session an idTag was issued for, if it is for this charger. */
async function sessionForTag(ctx: HandlerContext, tag: string) {
  const sessionId = parseIdTag(tag);
  if (sessionId === null) return null;
  const session = await ctx.db.chargingSession.findUnique({ where: { id: sessionId } });
  if (!session || session.ocppIdTag !== tag || session.status !== "ACTIVE") return null;
  if (session.chargerId !== ctx.chargePoint.id) return null;
  return session;
}

export const handlers: Record<string, Handler> = {
  async BootNotification(ctx, payload) {
    const p = parsePayload(BootNotification, payload);
    await ctx.db.charger.update({
      where: { id: ctx.chargePoint.id },
      data: {
        ocppVendor: p.chargePointVendor,
        ocppModel: p.chargePointModel,
        ocppFirmware: p.firmwareVersion ?? null,
        ocppLastSeen: new Date(),
      },
    });
    return { status: "Accepted", currentTime: new Date().toISOString(), interval: HEARTBEAT_INTERVAL_S };
  },

  async Heartbeat(_ctx, payload) {
    parsePayload(Heartbeat, payload);
    return { currentTime: new Date().toISOString() };
  },

  async StatusNotification(ctx, payload) {
    const p = parsePayload(StatusNotification, payload);
    let next = STATUS_MAP[p.status];
    // Connector 0 is the charge point as a whole; only its faults matter here.
    if (p.connectorId === 0 && p.status !== "Faulted" && p.status !== "Unavailable") return {};
    if (next === "AVAILABLE") {
      // The app has already claimed the charger for a driver who is about to
      // plug in, or a booking holds it; "Available" from the hardware doesn't
      // override either.
      const current = await ctx.db.charger.findUnique({ where: { id: ctx.chargePoint.id }, select: { status: true } });
      const active = await ctx.db.chargingSession.count({
        where: { chargerId: ctx.chargePoint.id, status: "ACTIVE" },
      });
      if (active > 0) next = "CHARGING";
      else if (current?.status === "RESERVED") next = "RESERVED";
    }
    await ctx.db.charger.update({ where: { id: ctx.chargePoint.id }, data: { status: next } });
    return {};
  },

  async Authorize(ctx, payload) {
    const p = parsePayload(Authorize, payload);
    return (await sessionForTag(ctx, p.idTag)) ? accepted : invalid;
  },

  async StartTransaction(ctx, payload) {
    const p = parsePayload(StartTransaction, payload);
    const session = await sessionForTag(ctx, p.idTag);
    // OCPP requires a transactionId even when the tag is refused; the charge
    // point must then stop at once. 0 is never a session id.
    if (!session || session.ocppTransactionId !== null) return { transactionId: 0, ...invalid };

    const at = new Date(p.timestamp);
    await ctx.db.chargingSession.update({
      where: { id: session.id },
      data: {
        ocppTransactionId: session.id,
        startTime: at,
        meterStartWh: p.meterStart,
        meterWh: p.meterStart,
        meterAt: at,
        meterKw: 0,
        meterTrace: [],
      },
    });
    await ctx.db.charger.update({ where: { id: ctx.chargePoint.id }, data: { status: "CHARGING" } });
    ctx.log?.(`transaction ${session.id} started`);
    return { transactionId: session.id, ...accepted };
  },

  async MeterValues(ctx, payload) {
    const p = parsePayload(MeterValues, payload);
    if (p.transactionId === undefined) return {};
    let reached = false;
    let target = 0;
    for (const mv of p.meterValue) {
      const applied = await applyMeterReading(ctx.db, p.transactionId, readMeterValue(mv));
      if (applied?.soc != null && applied.soc >= applied.targetPercent) {
        reached = true;
        target = applied.targetPercent;
      }
    }
    // The driver chose a target; the car doesn't know it. The CSMS stops the
    // transaction once the battery gets there, after answering this message.
    if (reached) {
      ctx.log?.(`transaction ${p.transactionId} reached ${target}%, stopping`);
      const transactionId = p.transactionId;
      setTimeout(() => void ctx.send("RemoteStopTransaction", { transactionId }).catch(() => {}), 0);
    }
    return {};
  },

  async StopTransaction(ctx, payload) {
    const p = parsePayload(StopTransaction, payload);
    for (const mv of p.transactionData ?? []) {
      await applyMeterReading(ctx.db, p.transactionId, readMeterValue(mv));
    }
    const session = await ctx.db.chargingSession.findUnique({ where: { ocppTransactionId: p.transactionId } });
    if (session) {
      await finishMeteredSession(ctx.db, session.id, {
        meterStopWh: p.meterStop,
        at: new Date(p.timestamp),
        reason: p.reason,
      });
      ctx.log?.(`transaction ${p.transactionId} stopped (${p.reason ?? "Local"})`);
    }
    return accepted;
  },

  async DataTransfer(_ctx, payload) {
    parsePayload(DataTransfer, payload);
    return { status: "UnknownVendorId" };
  },
};

export async function handleCall(ctx: HandlerContext, action: string, payload: unknown) {
  const handler = handlers[action];
  if (!handler) throw new OcppError("NotImplemented", `${action} is not supported by this CSMS`);
  return handler(ctx, payload);
}
