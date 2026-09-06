-- Fase 5 Bloque Final: trazabilidad de clasificación manual.

-- CreateEnum
CREATE TYPE "ClassificationSource" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "FinancialStatementLine" ADD COLUMN "classificationSource" "ClassificationSource" NOT NULL DEFAULT 'AUTO';
