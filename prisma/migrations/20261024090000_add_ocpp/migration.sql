-- AlterTable
ALTER TABLE "Charger" ADD COLUMN     "ocppFirmware" TEXT,
ADD COLUMN     "ocppIdentity" TEXT,
ADD COLUMN     "ocppLastSeen" TIMESTAMP(3),
ADD COLUMN     "ocppModel" TEXT,
ADD COLUMN     "ocppVendor" TEXT;

-- AlterTable
ALTER TABLE "ChargingSession" ADD COLUMN     "meterAt" TIMESTAMP(3),
ADD COLUMN     "meterKw" DOUBLE PRECISION,
ADD COLUMN     "meterSoc" INTEGER,
ADD COLUMN     "meterStartWh" INTEGER,
ADD COLUMN     "meterTrace" JSONB,
ADD COLUMN     "meterWh" INTEGER,
ADD COLUMN     "ocppIdTag" TEXT,
ADD COLUMN     "ocppTransactionId" INTEGER;

-- CreateTable
CREATE TABLE "OcppMessage" (
    "id" SERIAL NOT NULL,
    "identity" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "messageType" INTEGER NOT NULL,
    "messageId" TEXT NOT NULL,
    "action" TEXT,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Charger_ocppIdentity_key" ON "Charger"("ocppIdentity");

-- CreateIndex
CREATE UNIQUE INDEX "ChargingSession_ocppIdTag_key" ON "ChargingSession"("ocppIdTag");

-- CreateIndex
CREATE UNIQUE INDEX "ChargingSession_ocppTransactionId_key" ON "ChargingSession"("ocppTransactionId");

-- CreateIndex
CREATE INDEX "OcppMessage_createdAt_idx" ON "OcppMessage"("createdAt");

-- CreateIndex
CREATE INDEX "OcppMessage_identity_createdAt_idx" ON "OcppMessage"("identity", "createdAt");

-- Give every existing charger an OCPP identity, VG-<station>-<code>, e.g.
-- VG-01-A1. A charge point connects to ws://<csms>/ocpp/VG-01-A1.
UPDATE "Charger"
SET "ocppIdentity" = 'VG-' || LPAD("stationId"::text, 2, '0') || '-' || "chargerCode"
WHERE "ocppIdentity" IS NULL;
