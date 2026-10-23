import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { badRequest, conflict, forbidden, handler, notFound, parseId, requireAdmin } from "@/server/http";
import { userUpdateSchema } from "@/lib/validation";
import { isDemoAccount } from "@/lib/demo";
import { serializeUser } from "@/server/users";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const GET = handler(async (_r: Request, ctx: Params) => {
  await requireAdmin();
  const id = parseId((await ctx.params).id, "user id");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound("That user does not exist");
  return NextResponse.json({ user: serializeUser(user) });
});

/**
 * Staff edits to an account. Money is not editable here: a wallet balance
 * only moves through the payment ledger, so every baht has a receipt.
 * Operators manage drivers; only an admin can change roles or touch another
 * staff account.
 */
export const PATCH = handler(async (request: Request, ctx: Params) => {
  const staff = await requireAdmin();
  const id = parseId((await ctx.params).id, "user id");
  const body = userUpdateSchema.parse(await request.json());

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound("That user does not exist");

  if (staff.role !== "ADMIN") {
    if (body.role !== undefined) throw forbidden("Only an admin can change roles");
    if (user.role !== "USER") throw forbidden("Only an admin can edit staff accounts");
  }
  if (staff.id === id && body.isActive === false) {
    throw badRequest("You cannot disable your own account");
  }
  if (staff.id === id && body.role && body.role !== "ADMIN") {
    throw badRequest("You cannot remove your own admin role");
  }
  const changesAccess =
    (body.role !== undefined && body.role !== user.role) ||
    (body.isActive !== undefined && body.isActive !== user.isActive);
  if (changesAccess && isDemoAccount(user.email)) {
    throw forbidden("Demo accounts keep their role and stay active so everyone can try them");
  }

  const updated = await prisma.user.update({ where: { id }, data: body });
  return NextResponse.json({ user: serializeUser(updated) });
});

/**
 * Deletes an account that has never moved money. Anyone with a payment on
 * record is disabled instead, so the ledger keeps its history.
 */
export const DELETE = handler(async (_r: Request, ctx: Params) => {
  const staff = await requireAdmin();
  const id = parseId((await ctx.params).id, "user id");
  if (staff.id === id) throw badRequest("You cannot delete your own account");

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw notFound("That user does not exist");
  if (staff.role !== "ADMIN" && user.role !== "USER") {
    throw forbidden("Only an admin can delete staff accounts");
  }
  if (isDemoAccount(user.email)) {
    throw forbidden("Demo accounts cannot be deleted");
  }

  const active = await prisma.chargingSession.count({
    where: { userId: id, status: "ACTIVE" },
  });
  if (active) throw badRequest("This driver has a session running. Stop it first.");

  const payments = await prisma.payment.count({ where: { userId: id } });
  if (payments) {
    throw conflict("This account has payment history. Disable it instead so the records are kept.");
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
