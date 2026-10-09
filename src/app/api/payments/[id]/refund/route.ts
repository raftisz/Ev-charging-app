import { NextResponse } from "next/server";
import { forbidden, handler, requireUser } from "@/server/http";
import { refundPayment } from "@/server/payments";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Refund a paid charge to the driver's wallet. ADMIN only, not OPERATOR. */
export const POST = handler(async (_r: Request, ctx: Params) => {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw forbidden("Only an admin can issue refunds");
  return NextResponse.json(await refundPayment(Number((await ctx.params).id)));
});
