import "server-only";
import { prisma } from "@/server/db";
import { getActiveSession, listSessions } from "@/server/sessions";
import type { DriverSnapshot, NetworkSnapshot } from "@/lib/types";

export async function driverSnapshot(userId: number): Promise<DriverSnapshot> {
  return { scope: "driver", at: new Date().toISOString(), session: await getActiveSession(userId) };
}

export async function networkSnapshot(): Promise<NetworkSnapshot> {
  const [sessions, availableChargers, totalChargers] = await Promise.all([
    listSessions({ status: "ACTIVE" }, 50),
    prisma.charger.count({ where: { status: "AVAILABLE" } }),
    prisma.charger.count(),
  ]);
  return {
    scope: "network",
    at: new Date().toISOString(),
    sessions,
    availableChargers,
    totalChargers,
    networkKw: Number(sessions.reduce((sum, s) => sum + s.currentKw, 0).toFixed(1)),
  };
}
