import "server-only";
import { prisma } from "@/server/db";
import { PAYMENT_METHOD_LABEL } from "@/lib/payments";
import { thb } from "@/lib/format";
import { badRequest, conflict, notFound } from "@/server/http";
import { promptPayQr } from "@/server/promptpay";
import { bangkokDay } from "@/lib/timezone";
import type { ReceiptDTO } from "@/lib/types";
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

/**
 * Starts a PromptPay payment: a PENDING row and a QR for its exact amount.
 * Asking again for the same session and amount returns the same pending row
 * rather than piling up new ones.
 */
export async function startPromptPay(input: {
  userId: number;
  type: "CHARGE" | "TOPUP";
  amount: number;
  sessionId?: number;
}) {
  const existing = input.sessionId
    ? await prisma.payment.findFirst({
        where: {
          sessionId: input.sessionId,
          type: input.type,
          method: "PROMPTPAY",
          status: "PENDING",
          amount: input.amount,
        },
        include: paymentInclude,
        orderBy: { createdAt: "desc" },
      })
    : null;
  const payment =
    existing ??
    (await prisma.payment.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        type: input.type,
        amount: input.amount,
        method: "PROMPTPAY",
        status: "PENDING",
      },
      include: paymentInclude,
    }));
  return { payment: serializePayment(payment), promptpay: promptPayQr(payment.amount) };
}

/**
 * Marks a pending PromptPay payment as received. There is no bank feed, so
 * the payer confirms it themselves (the demo "ยืนยันการชำระ" button). The
 * payment, the session or wallet it settles, all change in one transaction,
 * and only a PENDING row can be confirmed, so a second confirm gets 409.
 */
export async function confirmPromptPay(paymentId: number, userId: number) {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.userId !== userId) throw notFound("That payment does not exist");
    if (payment.method !== "PROMPTPAY") throw badRequest("Only PromptPay payments are confirmed this way");

    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "PAID", providerRef: `PP-${payment.id}-${Date.now()}` },
    });
    if (claimed.count === 0) throw conflict("This payment is no longer pending");

    let balance: number | null = null;
    if (payment.type === "CHARGE" && payment.sessionId) {
      const settled = await tx.chargingSession.updateMany({
        where: {
          id: payment.sessionId,
          status: { not: "ACTIVE" },
          paymentStatus: { in: ["PENDING", "FAILED"] },
        },
        data: { paymentStatus: "PAID", paymentMethod: PAYMENT_METHOD_LABEL.PROMPTPAY },
      });
      if (settled.count === 0) throw conflict("This session is already paid");
    } else if (payment.type === "TOPUP") {
      const user = await tx.user.update({
        where: { id: userId },
        data: { walletBalance: { increment: payment.amount } },
      });
      balance = user.walletBalance;
    }

    const updated = await tx.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: paymentInclude,
    });
    return { payment: updated, balance };
  });

  const { payment, balance } = result;
  await prisma.notification.create({
    data:
      payment.type === "TOPUP"
        ? {
            userId,
            type: "PAYMENT",
            title: "Wallet topped up",
            body: `${thb(payment.amount)} added with PromptPay QR. New balance ${thb(balance ?? 0)}.`,
          }
        : {
            userId,
            type: "PAYMENT",
            title: "Payment received",
            body: `${thb(payment.amount)} paid with PromptPay QR for session #${payment.sessionId}.`,
          },
  });

  return { payment: serializePayment(payment), balance };
}

/** VG-20261009-000812: the Bangkok date it was made, then the payment id. */
export function receiptNumber(payment: { id: number; createdAt: Date }) {
  return `VG-${bangkokDay(payment.createdAt).replaceAll("-", "")}-${String(payment.id).padStart(6, "0")}`;
}

/**
 * One payment as a receipt. Drivers see only their own; admins see any.
 * Everyone else gets "not found" rather than "forbidden", so receipt ids
 * cannot be probed for existence.
 */
export async function getReceipt(
  paymentId: number,
  viewer: { id: number; role: string },
): Promise<ReceiptDTO> {
  const payment = Number.isInteger(paymentId)
    ? await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          ...paymentInclude,
          user: { select: { id: true, fullName: true, email: true } },
          session: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              energyKwh: true,
              pricePerKwh: true,
              station: { select: { name: true, address: true } },
              charger: { select: { chargerCode: true } },
            },
          },
        },
      })
    : null;
  if (!payment || (payment.userId !== viewer.id && viewer.role !== "ADMIN")) {
    throw notFound("That receipt does not exist");
  }
  const s = payment.session;
  return {
    receiptNo: receiptNumber(payment),
    payment: serializePayment(payment),
    customer: payment.user,
    session: s
      ? {
          id: s.id,
          stationName: s.station.name,
          stationAddress: s.station.address,
          chargerCode: s.charger.chargerCode,
          startTime: s.startTime.toISOString(),
          endTime: s.endTime?.toISOString() ?? null,
          energyKwh: s.energyKwh,
          pricePerKwh: s.pricePerKwh,
        }
      : null,
  };
}
