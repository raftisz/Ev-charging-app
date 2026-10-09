import { NextResponse } from "next/server";
import { handler, requireUser } from "@/server/http";
import { listPayments } from "@/server/payments";

export const dynamic = "force-dynamic";

/** The signed-in driver's balance and most recent money movements. */
export const GET = handler(async () => {
  const user = await requireUser();
  return NextResponse.json({
    balance: user.walletBalance,
    transactions: await listPayments(user.id),
  });
});
