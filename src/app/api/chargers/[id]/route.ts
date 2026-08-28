import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { badRequest, handler, notFound, requireAdmin } from "@/server/http";
import { chargerUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request: Request, ctx: Params) => {
  await requireAdmin();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) throw badRequest("Invalid charger id");

  const body = chargerUpdateSchema.parse(await request.json());
  const charger = await prisma.charger.findUnique({ where: { id } });
  if (!charger) throw notFound("That charger does not exist");

  const updated = await prisma.charger.update({
    where: { id },
    data: {
      chargerCode: body.chargerCode,
      powerKw: body.powerKw,
      status: body.status,
      connectors: body.connectorType
        ? {
            deleteMany: {},
            create: [{ type: body.connectorType, powerKw: body.powerKw ?? charger.powerKw }],
          }
        : undefined,
    },
    include: { connectors: true },
  });

  return NextResponse.json({ charger: updated });
});

export const DELETE = handler(async (_r: Request, ctx: Params) => {
  await requireAdmin();
  const id = Number((await ctx.params).id);
  const charger = await prisma.charger.findUnique({ where: { id } });
  if (!charger) throw notFound("That charger does not exist");

  const active = await prisma.chargingSession.count({
    where: { chargerId: id, status: "ACTIVE" },
  });
  if (active) throw badRequest("This charger has a session running. Stop it first.");

  await prisma.charger.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
