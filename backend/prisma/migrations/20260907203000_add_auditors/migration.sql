CREATE TABLE "Auditor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "professionalTitles" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "externalAuditorRegistration" TEXT NOT NULL,
    "judicialExpertNumber" TEXT NOT NULL,
    "accountantLicenseNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Auditor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Auditor_organizationId_cedula_key" ON "Auditor"("organizationId", "cedula");
CREATE UNIQUE INDEX "Auditor_organizationId_ruc_key" ON "Auditor"("organizationId", "ruc");
CREATE UNIQUE INDEX "Auditor_organizationId_externalAuditorRegistration_key" ON "Auditor"("organizationId", "externalAuditorRegistration");
CREATE INDEX "Auditor_organizationId_idx" ON "Auditor"("organizationId");
CREATE INDEX "Auditor_fullName_idx" ON "Auditor"("fullName");
ALTER TABLE "Auditor" ADD CONSTRAINT "Auditor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
