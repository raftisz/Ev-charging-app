import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { badRequest, handler, notFound, requireAdmin } from "@/server/http";
import { userUpdateSchema } from "@/lib/validation";
import { serializeUser } from "@/server/users";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const GET = handler(async (_r: Request, ctx: Params) => {
  await requireAdmin();
  const id = Number((await ctx.params).id);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound("That user does not exist");
  return NextResponse.json({ user: serializeUser(user) });
});

export const PATCH = handler(async (request: Request, ctx: Params) => {
  const admin = await requireAdmin();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) throw badRequest("Invalid user id");

  const body = userUpdateSchema.parse(await request.json());
  if (admin.id === id && body.isActive === false) {
    throw badRequest("You cannot disable your own account");
  }
  if (admin.id === id && body.role && body.role !== "ADMIN") {
    throw badRequest("You cannot remove your own admin role");
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound("That user does not exist");

  const updated = await prisma.user.update({ where: { id }, data: body });
  return NextResponse.json({ user: serializeUser(updated) });
});

export const DELETE = handler(async (_r: Request, ctx: Params) => {
  const admin = await requireAdmin();
  const id = Number((await ctx.params).id);
  if (admin.id === id) throw badRequest("You cannot delete your own account");

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound("That user does not exist");

  const active = await prisma.chargingSession.count({
    where: { userId: id, status: "ACTIVE" },
  });
  if (active) throw badRequest("This driver has a session running. Stop it first.");

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
