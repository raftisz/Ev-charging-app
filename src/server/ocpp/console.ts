import "server-only";
import { prisma } from "@/server/db";
import { isOcppOnline } from "@/lib/ocpp";
import { csmsConfigured, csmsHealth } from "@/server/ocpp/commands";
import type { OcppConsoleDTO } from "@/lib/types";

const FRAME_LIMIT = 120;

/** Everything the admin OCPP console shows: charge points and recent frames. */
export async function getOcppConsole(identity?: string | null): Promise<OcppConsoleDTO> {
  const [health, chargers, frames] = await Promise.all([
    csmsHealth(),
    prisma.charger.findMany({
      where: { ocppIdentity: { not: null } },
      select: {
        id: true,
        chargerCode: true,
        powerKw: true,
        status: true,
        ocppIdentity: true,
        ocppLastSeen: true,
        ocppVendor: true,
        ocppModel: true,
        ocppFirmware: true,
        station: { select: { id: true, name: true } },
        sessions: {
          where: { status: "ACTIVE", ocppIdTag: { not: null } },
          select: {
            id: true,
            ocppTransactionId: true,
            meterWh: true,
            meterStartWh: true,
            meterKw: true,
            meterSoc: true,
            user: { select: { fullName: true } },
          },
          take: 1,
        },
      },
      orderBy: [{ stationId: "asc" }, { chargerCode: "asc" }],
    }),
    prisma.ocppMessage.findMany({
      where: identity ? { identity } : {},
      orderBy: { id: "desc" },
      take: FRAME_LIMIT,
    }),
  ]);

  // A CALLRESULT carries no action name; borrow it from the CALL it answers.
  const ids = frames.filter((f) => f.messageType !== 2).map((f) => f.messageId);
  const calls = ids.length
    ? await prisma.ocppMessage.findMany({
        where: { messageType: 2, messageId: { in: ids } },
        select: { messageId: true, action: true },
      })
    : [];
  const actionOf = new Map(calls.map((c) => [c.messageId, c.action]));

  const chargePoints = chargers.map((c) => {
    const s = c.sessions[0];
    return {
      chargerId: c.id,
      identity: c.ocppIdentity!,
      station: c.station,
      chargerCode: c.chargerCode,
      powerKw: c.powerKw,
      status: c.status,
      online: isOcppOnline(c.ocppLastSeen),
      lastSeen: c.ocppLastSeen?.toISOString() ?? null,
      vendor: c.ocppVendor,
      model: c.ocppModel,
      firmware: c.ocppFirmware,
      transaction: s
        ? {
            sessionId: s.id,
            transactionId: s.ocppTransactionId,
            driver: s.user.fullName,
            energyKwh: Number((((s.meterWh ?? 0) - (s.meterStartWh ?? s.meterWh ?? 0)) / 1000).toFixed(2)),
            kw: s.meterKw ?? 0,
            soc: s.meterSoc,
          }
        : null,
    };
  });
  chargePoints.sort((a, b) => Number(b.online) - Number(a.online));

  return {
    configured: csmsConfigured(),
    reachable: health.reachable,
    chargePoints,
    frames: frames.map((f) => ({
      id: f.id,
      identity: f.identity,
      direction: f.direction as "in" | "out",
      messageType: f.messageType,
      messageId: f.messageId,
      action: f.action ?? actionOf.get(f.messageId) ?? null,
      payload: f.payload,
      createdAt: f.createdAt.toISOString(),
    })),
  };
}
