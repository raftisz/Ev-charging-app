import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, handler, notFound, requireUser } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

async function parse(params: Params["params"]) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid station id");
  return id;
}

export const POST = handler(async (_request: Request, ctx: Params) => {
  const user = await requireUser();
  const stationId = await parse(ctx.params);
  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) throw notFound("That station does not exist");

  await prisma.favorite.upsert({
    where: { userId_stationId: { userId: user.id, stationId } },
    create: { userId: user.id, stationId },
    update: {},
  });
  return NextResponse.json({ isFavorite: true });
});

export const DELETE = handler(async (_request: Request, ctx: Params) => {
  const user = await requireUser();
  const stationId = await parse(ctx.params);
  await prisma.favorite.deleteMany({ where: { userId: user.id, stationId } });
  return NextResponse.json({ isFavorite: false });
});
