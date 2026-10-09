import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { badRequest, handler, notFound } from "@/server/http";
import { chargerSlots } from "@/server/reservations";
import { bangkokDay } from "@/lib/timezone";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const GET = handler(async (request: Request, ctx: Params) => {
  const stationId = Number((await ctx.params).id);
  if (!Number.isInteger(stationId)) throw badRequest("Invalid station id");

  const url = new URL(request.url);
  const day = url.searchParams.get("date") ?? bangkokDay();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw badRequest("Use date=YYYY-MM-DD");
  const duration = Number(url.searchParams.get("duration") ?? 45);

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    include: { chargers: { orderBy: { chargerCode: "asc" } } },
  });
  if (!station) throw notFound("That station does not exist");

  const chargers = await Promise.all(
    station.chargers.map(async (charger) => ({
      id: charger.id,
      chargerCode: charger.chargerCode,
      powerKw: charger.powerKw,
      status: charger.status,
      bookable: charger.status !== "OFFLINE" && charger.status !== "MAINTENANCE",
      slots: await chargerSlots(charger.id, day, duration),
    })),
  );

  return NextResponse.json({ date: day, durationMinutes: duration, chargers });
});
