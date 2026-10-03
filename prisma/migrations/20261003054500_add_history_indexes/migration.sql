-- CreateIndex
CREATE INDEX "Reservation_userId_startTime_idx" ON "Reservation"("userId", "startTime");

-- CreateIndex
CREATE INDEX "ChargingSession_userId_startTime_idx" ON "ChargingSession"("userId", "startTime");

-- CreateIndex
CREATE INDEX "ChargingSession_startTime_idx" ON "ChargingSession"("startTime");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
