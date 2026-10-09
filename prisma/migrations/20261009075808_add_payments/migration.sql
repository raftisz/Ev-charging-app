-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('WALLET', 'CREDIT_CARD', 'PROMPTPAY');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CHARGE', 'TOPUP', 'REFUND');

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER,
    "userId" INTEGER NOT NULL,
    "type" "PaymentType" NOT NULL DEFAULT 'CHARGE',
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_sessionId_idx" ON "Payment"("sessionId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChargingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every session already settled gets its ledger row, so the
-- wallet history is complete from the moment this table exists.
INSERT INTO "Payment" ("sessionId", "userId", "type", "amount", "method", "status", "createdAt")
SELECT
    s."id",
    s."userId",
    'CHARGE',
    s."cost",
    CASE s."paymentMethod"
        WHEN 'Credit card' THEN 'CREDIT_CARD'::"PaymentMethod"
        WHEN 'PromptPay QR' THEN 'PROMPTPAY'::"PaymentMethod"
        ELSE 'WALLET'::"PaymentMethod"
    END,
    s."paymentStatus",
    COALESCE(s."endTime", s."startTime")
FROM "ChargingSession" s
WHERE s."paymentStatus" IN ('PAID', 'REFUNDED');
