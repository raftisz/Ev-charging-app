import { NextResponse } from "next/server";
import { badRequest, handler, requireUser } from "@/server/http";
import { confirmPromptPay } from "@/server/payments";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Simulated bank confirmation for a pending PromptPay payment. */
export const POST = handler(async (_r: Request, ctx: Params) => {
  const user = await requireUser();
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) throw badRequest("Invalid payment id");
  return NextResponse.json(await confirmPromptPay(id, user.id));
});
