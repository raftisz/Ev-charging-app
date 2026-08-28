import "server-only";
import { prisma } from "@/server/db";
import type { ReservationDTO } from "@/lib/types";

export const RESERVATION_INCLUDE = {
  station: { select: { id: true, name: true, address: true, pricePerKwh: true } },
  charger: { select: { id: true, chargerCode: true, powerKw: true } },
  user: { select: { id: true, fullName: true, email: true } },
} as const;

type ReservationRecord = Awaited<
  ReturnType<
    typeof prisma.reservation.findFirstOrThrow<{ include: typeof RESERVATION_INCLUDE }>
  >
>;

export function serializeReservation(r: ReservationRecord): ReservationDTO {
  return {
    id: r.id,
    status: r.status,
    startTime: r.startTime.toISOString(),
    endTime: r.endTime.toISOString(),
    estimatedKwh: r.estimatedKwh,
    reservationFee: r.reservationFee,
    estimatedCost: r.estimatedCost,
    station: r.station,
    charger: r.charger,
    user: r.user,
  };
}

/** Half-hour slots the station is bookable for, on the given calendar day. */
export const SLOT_TIMES = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
  "20:00", "20:30",
];

export type Slot = {
  time: string;
  iso: string;
  available: boolean;
  reason?: "past" | "booked";
};

export function slotDate(day: string, time: string) {
  return new Date(`${day}T${time}:00`);
}

/** Availability for one charger on one day, taking existing bookings into account. */
export async function chargerSlots(
  chargerId: number,
  day: string,
  durationMinutes: number,
): Promise<Slot[]> {
  const dayStart = new Date(`${day}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3_600_000);

  const booked = await prisma.reservation.findMany({
    where: {
      chargerId,
      status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
      startTime: { gte: dayStart, lt: dayEnd },
    },
    select: { startTime: true, endTime: true },
  });

  const now = Date.now();

  return SLOT_TIMES.map((time) => {
    const start = slotDate(day, time);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    if (start.getTime() < now) {
      return { time, iso: start.toISOString(), available: false, reason: "past" as const };
    }
    const clash = booked.some((b) => start < b.endTime && end > b.startTime);
    return clash
      ? { time, iso: start.toISOString(), available: false, reason: "booked" as const }
      : { time, iso: start.toISOString(), available: true };
  });
}

export async function hasClash(
  chargerId: number,
  start: Date,
  end: Date,
  ignoreReservationId?: number,
) {
  const clash = await prisma.reservation.findFirst({
    where: {
      chargerId,
      id: ignoreReservationId ? { not: ignoreReservationId } : undefined,
      status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] },
      startTime: { lt: end },
      endTime: { gt: start },
    },
  });
  return Boolean(clash);
}
