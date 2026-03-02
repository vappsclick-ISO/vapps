-- CreateTable
CREATE TABLE "UserNotificationDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserNotificationDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserNotificationDismissal_userId_organizationId_idx" ON "UserNotificationDismissal"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationDismissal_userId_organizationId_activityId_key" ON "UserNotificationDismissal"("userId", "organizationId", "activityId");

-- AddForeignKey
ALTER TABLE "UserNotificationDismissal" ADD CONSTRAINT "UserNotificationDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
