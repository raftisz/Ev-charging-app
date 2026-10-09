import "server-only";
import { prisma } from "@/server/db";
import { PAYMENT_METHOD_LABEL } from "@/lib/payments";
import type { PaymentDTO } from "@/lib/types";

const paymentInclude = {
  session: { select: { id: true, station: { select: { name: true } } } },
} as const;

type PaymentRecord = Awaited<
  ReturnType<typeof prisma.payment.findFirstOrThrow<{ include: typeof paymentInclude }>>
>;

export const PAYMENT_INCLUDE = paymentInclude;

export function serializePayment(payment: PaymentRecord): PaymentDTO {
  return {
    id: payment.id,
    type: payment.type,
    amount: payment.amount,
    method: payment.method,
    methodLabel: PAYMENT_METHOD_LABEL[payment.method],
    status: payment.status,
    providerRef: payment.providerRef,
    createdAt: payment.createdAt.toISOString(),
    sessionId: payment.session?.id ?? null,
    stationName: payment.session?.station.name ?? null,
  };
}

export async function listPayments(userId: number, take = 50) {
  const payments = await prisma.payment.findMany({
    where: { userId },
    include: paymentInclude,
    orderBy: { createdAt: "desc" },
    take,
  });
  return payments.map(serializePayment);
}
