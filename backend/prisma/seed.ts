import { grantAdminPermissions, ADMIN_PERMISSION_KEYS } from '../src/auth/admin-permissions';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: 'development-organization' },
    update: {},
    create: { id: 'development-organization', name: 'Organización de Desarrollo', legalName: 'Organización de Desarrollo' },
  });

  const permissions = ADMIN_PERMISSION_KEYS;
  for (const key of permissions) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
  for (const name of ['ADMIN', 'AUDITOR', 'ASISTENTE', 'LECTURA']) {
    const role = await prisma.role.upsert({
      where: { organizationId_name: { organizationId: organization.id, name } },
      update: {},
      create: { organizationId: organization.id, name, system: true },
    });
    if (name === 'ADMIN') await prisma.$transaction(tx => grantAdminPermissions(tx, role.id));
  }
}

main()
  .finally(async () => prisma.$disconnect());


