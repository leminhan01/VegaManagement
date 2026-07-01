-- CreateTable
CREATE TABLE "EmailReportConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "recipients" TEXT[],
    "intervalHours" INTEGER NOT NULL,
    "sections" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailReportConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "reportConfigId" TEXT NOT NULL,
    "recipients" TEXT[],
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "payloadSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailReportConfig_isActive_nextRunAt_idx" ON "EmailReportConfig"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "EmailLog_reportConfigId_idx" ON "EmailLog"("reportConfigId");

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_reportConfigId_fkey" FOREIGN KEY ("reportConfigId") REFERENCES "EmailReportConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
