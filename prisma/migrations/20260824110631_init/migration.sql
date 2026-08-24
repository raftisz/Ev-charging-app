-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "avatarInit" TEXT,
    "vehicleMake" TEXT,
    "vehicleModel" TEXT,
    "vehiclePlate" TEXT,
    "batteryKwh" REAL,
    "walletBalance" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Station" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Bangkok',
    "country" TEXT NOT NULL DEFAULT 'Thailand',
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "operator" TEXT NOT NULL DEFAULT 'Volt Grid',
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "openingHours" TEXT NOT NULL DEFAULT '24 Hours',
    "pricePerKwh" REAL NOT NULL,
    "rating" REAL NOT NULL DEFAULT 4.5,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "amenities" TEXT NOT NULL DEFAULT '',
    "imageHue" INTEGER NOT NULL DEFAULT 220,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Charger" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stationId" INTEGER NOT NULL,
    "chargerCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "powerKw" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Charger_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Connector" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chargerId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "powerKw" REAL NOT NULL,
    CONSTRAINT "Connector_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "stationId" INTEGER NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "estimatedKwh" REAL NOT NULL DEFAULT 0,
    "reservationFee" REAL NOT NULL DEFAULT 20,
    "estimatedCost" REAL NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reservation_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reservation_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChargingSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "stationId" INTEGER NOT NULL,
    "chargerId" INTEGER NOT NULL,
    "reservationId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" DATETIME,
    "startPercent" INTEGER NOT NULL DEFAULT 20,
    "currentPercent" INTEGER NOT NULL DEFAULT 20,
    "targetPercent" INTEGER NOT NULL DEFAULT 80,
    "energyKwh" REAL NOT NULL DEFAULT 0,
    "powerKw" REAL NOT NULL DEFAULT 0,
    "pricePerKwh" REAL NOT NULL,
    "cost" REAL NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChargingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChargingSession_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChargingSession_chargerId_fkey" FOREIGN KEY ("chargerId") REFERENCES "Charger" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChargingSession_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "stationId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Favorite_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Station_status_idx" ON "Station"("status");

-- CreateIndex
CREATE INDEX "Charger_status_idx" ON "Charger"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Charger_stationId_chargerCode_key" ON "Charger"("stationId", "chargerCode");

-- CreateIndex
CREATE INDEX "Reservation_userId_status_idx" ON "Reservation"("userId", "status");

-- CreateIndex
CREATE INDEX "Reservation_chargerId_startTime_idx" ON "Reservation"("chargerId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "ChargingSession_reservationId_key" ON "ChargingSession"("reservationId");

-- CreateIndex
CREATE INDEX "ChargingSession_userId_status_idx" ON "ChargingSession"("userId", "status");

-- CreateIndex
CREATE INDEX "ChargingSession_status_idx" ON "ChargingSession"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_stationId_key" ON "Favorite"("userId", "stationId");
