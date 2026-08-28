import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getSession } from "@/server/auth";
import { badRequest, handler, notFound, requireAdmin } from "@/server/http";
import { stationUpdateSchema } from "@/lib/validation";
import { getStation, serializeStation } from "@/server/stations";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function stationId(params: Params["params"]) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid station id");
  return id;
}

export const GET = handler(async (_request: Request, ctx: Params) => {
  const session = await getSession();
  const station = await getStation(await stationId(ctx.params), session?.userId);
  if (!station) throw notFound("That station does not exist");
  return NextResponse.json({ station });
});

export const PATCH = handler(async (request: Request, ctx: Params) => {
  await requireAdmin();
  const id = await stationId(ctx.params);
  const body = stationUpdateSchema.parse(await request.json());
  const existing = await prisma.station.findUnique({ where: { id } });
  if (!existing) throw notFound("That station does not exist");

  const station = await prisma.station.update({
    where: { id },
    data: body,
    include: { chargers: { include: { connectors: true } } },
  });
  return NextResponse.json({ station: serializeStation(station) });
});

export const DELETE = handler(async (_request: Request, ctx: Params) => {
  await requireAdmin();
  const id = await stationId(ctx.params);
  const existing = await prisma.station.findUnique({ where: { id } });
  if (!existing) throw notFound("That station does not exist");

  const active = await prisma.chargingSession.count({
    where: { stationId: id, status: "ACTIVE" },
  });
  if (active > 0) {
    throw badRequest("Stop the active charging sessions at this station first");
  }

  await prisma.station.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
