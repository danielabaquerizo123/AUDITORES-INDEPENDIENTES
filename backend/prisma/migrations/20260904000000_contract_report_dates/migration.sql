-- Fase 4 (bloque final): fechas contractuales persistidas.
-- finalReportDueDate se representa con reportDeliveryDate y
-- taxComplianceReportDueDate con taxReportDeliveryDate (sin columnas duplicadas).

ALTER TABLE "Contract" ADD COLUMN "reportDeliveryDate" DATE;
ALTER TABLE "Contract" ADD COLUMN "taxReportDeliveryDate" DATE;
ALTER TABLE "Contract" ADD COLUMN "informationDeliveryDate" DATE;
ALTER TABLE "Contract" ADD COLUMN "draftReportDueDate" DATE;
