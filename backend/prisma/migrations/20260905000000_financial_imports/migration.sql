-- Fase 5 Bloque 1: importación de estados financieros.

-- CreateEnum
CREATE TYPE "FinancialImportStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'REVIEW_REQUIRED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "FinancialStatementType" AS ENUM ('FINANCIAL_POSITION', 'COMPREHENSIVE_INCOME', 'CHANGES_IN_EQUITY', 'CASH_FLOW');

-- CreateTable
CREATE TABLE "FinancialImport" (
    "id" TEXT NOT NULL,
    "auditPeriodId" TEXT NOT NULL,
    "uploadedById" TEXT,
    "originalFileName" TEXT NOT NULL,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "sizeBytes" BIGINT,
    "sha256" TEXT,
    "status" "FinancialImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "currentYear" INTEGER,
    "previousYear" INTEGER,
    "processingError" TEXT,
    "detectionSummary" JSONB,
    "validationIssues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialStatement" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "type" "FinancialStatementType" NOT NULL,
    "sheetName" TEXT,
    "currentYear" INTEGER,
    "previousYear" INTEGER,
    "detected" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DOUBLE PRECISION,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialStatementLine" (
    "id" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "rawLabel" TEXT NOT NULL,
    "normalizedKey" TEXT,
    "classified" BOOLEAN NOT NULL DEFAULT false,
    "sheetName" TEXT,
    "sourceRow" INTEGER,
    "sourceCurrentColumn" INTEGER,
    "sourcePreviousColumn" INTEGER,
    "currentValue" DECIMAL(18,2),
    "previousValue" DECIMAL(18,2),
    "difference" DECIMAL(18,2),
    "percentageChange" DECIMAL(10,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialImport_auditPeriodId_idx" ON "FinancialImport"("auditPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialStatement_importId_type_key" ON "FinancialStatement"("importId", "type");

-- CreateIndex
CREATE INDEX "FinancialStatement_importId_idx" ON "FinancialStatement"("importId");

-- CreateIndex
CREATE INDEX "FinancialStatementLine_statementId_sortOrder_idx" ON "FinancialStatementLine"("statementId", "sortOrder");

-- AddForeignKey
ALTER TABLE "FinancialImport" ADD CONSTRAINT "FinancialImport_auditPeriodId_fkey" FOREIGN KEY ("auditPeriodId") REFERENCES "AuditPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialImport" ADD CONSTRAINT "FinancialImport_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStatement" ADD CONSTRAINT "FinancialStatement_importId_fkey" FOREIGN KEY ("importId") REFERENCES "FinancialImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStatementLine" ADD CONSTRAINT "FinancialStatementLine_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "FinancialStatement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
