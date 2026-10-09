import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handler, requireUser } from "@/server/http";
import { topUpSchema } from "@/lib/validation";
import { PAYMENT_METHOD_LABEL, toSatang } from "@/lib/payments";
import { thb } from "@/lib/format";
import { PAYMENT_INCLUDE, serializePayment, startPromptPay } from "@/server/payments";

export const dynamic = "force-dynamic";

/**
 * Adds money to the wallet. A card top-up is approved straight away (no card
 * provider is connected yet); a PromptPay top-up returns a QR and is credited
 * when it is confirmed at POST /api/payments/{id}/confirm.
 */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const { amount, method } = topUpSchema.parse(await request.json().catch(() => ({})));
  const total = toSatang(amount);

  // PromptPay credits the wallet only once the transfer is confirmed.
  if (method === "PROMPTPAY") {
    const started = await startPromptPay({ userId: user.id, type: "TOPUP", amount: total });
    return NextResponse.json({ balance: user.walletBalance, ...started }, { status: 202 });
  }

  const { balance, payment } = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: user.id },
      data: { walletBalance: { increment: total } },
    });
    const payment = await tx.payment.create({
      data: { userId: user.id, type: "TOPUP", amount: total, method, status: "PAID" },
      include: PAYMENT_INCLUDE,
    });
    return { balance: updated.walletBalance, payment };
  });

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "PAYMENT",
      title: "Wallet topped up",
      body: `${thb(total)} added with ${PAYMENT_METHOD_LABEL[method]}. New balance ${thb(balance)}.`,
    },
  });

  return NextResponse.json({ balance, payment: serializePayment(payment) }, { status: 201 });
});
