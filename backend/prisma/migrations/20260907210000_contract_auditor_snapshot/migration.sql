ALTER TABLE "Contract" ADD COLUMN "auditorId" TEXT;
ALTER TABLE "Contract" ADD COLUMN "auditorSnapshot" JSONB;
CREATE INDEX "Contract_auditorId_idx" ON "Contract"("auditorId");
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "Auditor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
