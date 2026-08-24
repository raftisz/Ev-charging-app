import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, handler, notFound, requireUser } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

async function load(ctx: Params, userId: number) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) throw badRequest("Invalid notification id");
  const row = await prisma.notification.findUnique({ where: { id } });
  if (!row) throw notFound("That notification does not exist");
  if (row.userId !== userId) throw forbidden();
  return row;
}

export const PATCH = handler(async (_r: Request, ctx: Params) => {
  const user = await requireUser();
  const row = await load(ctx, user.id);
  const updated = await prisma.notification.update({
    where: { id: row.id },
    data: { isRead: true },
  });
  return NextResponse.json({ notification: { ...updated, createdAt: updated.createdAt.toISOString() } });
});

export const DELETE = handler(async (_r: Request, ctx: Params) => {
  const user = await requireUser();
  const row = await load(ctx, user.id);
  await prisma.notification.delete({ where: { id: row.id } });
  return NextResponse.json({ ok: true });
});
