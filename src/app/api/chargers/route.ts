import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { conflict, handler, notFound, requireAdmin } from "@/lib/http";
import { chargerCreateSchema } from "@/lib/validation";
import { CONNECTOR_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export const GET = handler(async (request: Request) => {
  await requireAdmin();
  const p = new URL(request.url).searchParams;
  const stationId = p.get("stationId") ? Number(p.get("stationId")) : undefined;
  const status = p.get("status") ?? undefined;

  const chargers = await prisma.charger.findMany({
    where: {
      stationId,
      status: status as never,
    },
    include: {
      connectors: true,
      station: { select: { id: true, name: true } },
    },
    orderBy: [{ stationId: "asc" }, { chargerCode: "asc" }],
  });

  return NextResponse.json({
    chargers: chargers.map((c) => ({
      id: c.id,
      chargerCode: c.chargerCode,
      status: c.status,
      powerKw: c.powerKw,
      station: c.station,
      connectors: c.connectors.map((x) => ({
        id: x.id,
        type: x.type,
        label: CONNECTOR_LABEL[x.type] ?? x.type,
        powerKw: x.powerKw,
      })),
    })),
  });
});

export const POST = handler(async (request: Request) => {
  await requireAdmin();
  const body = chargerCreateSchema.parse(await request.json());

  const station = await prisma.station.findUnique({ where: { id: body.stationId } });
  if (!station) throw notFound("That station does not exist");

  const duplicate = await prisma.charger.findFirst({
    where: { stationId: body.stationId, chargerCode: body.chargerCode },
  });
  if (duplicate) throw conflict(`Charger ${body.chargerCode} already exists here`);

  const charger = await prisma.charger.create({
    data: {
      stationId: body.stationId,
      chargerCode: body.chargerCode,
      powerKw: body.powerKw,
      status: body.status,
      connectors: { create: [{ type: body.connectorType, powerKw: body.powerKw }] },
    },
    include: { connectors: true },
  });

  return NextResponse.json({ charger }, { status: 201 });
});
