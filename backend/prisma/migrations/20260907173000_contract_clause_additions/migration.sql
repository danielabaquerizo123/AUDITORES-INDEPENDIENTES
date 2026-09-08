-- Contenido manual asociado a un contrato; las filas existentes continúan
-- representando los párrafos de la plantilla maestra.
ALTER TABLE "ContractClause"
  ADD COLUMN "isCustom" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "parentClauseKey" TEXT;
