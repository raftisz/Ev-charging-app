import { NextResponse } from "next/server";
import { handler, requireUser } from "@/server/http";
import { getReceipt } from "@/server/payments";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** A payment as a receipt: the payer's own, or any for an admin (else 404). */
export const GET = handler(async (_r: Request, ctx: Params) => {
  const user = await requireUser();
  const id = Number((await ctx.params).id);
  return NextResponse.json({ receipt: await getReceipt(id, user) });
});
