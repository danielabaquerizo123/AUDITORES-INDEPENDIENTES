import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { grantAdminPermissions } from '../src/auth/admin-permissions';

const ADMIN_EMAIL = 'admin@sistema.local';
const ORGANIZATION_ID = 'development-organization';

function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('Se requiere una terminal interactiva para ingresar la contraseña.');

  process.stdout.write('Contraseña del administrador: ');
  return new Promise((resolve) => {
    let password = '';
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', function onData(chunk: Buffer) {
      for (const byte of chunk) {
        if (byte === 3) process.exit(1);
        if (byte === 13 || byte === 10) {
          process.stdin.off('data', onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(password);
          return;
        }
        if (byte === 127 || byte === 8) {
          password = password.slice(0, -1);
          continue;
        }
        password += Buffer.from([byte]).toString();
      }
    });
  });
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const organization = await prisma.organization.upsert({
      where: { id: ORGANIZATION_ID },
      update: {},
      create: {
        id: ORGANIZATION_ID,
        name: ORGANIZATION_ID,
        legalName: ORGANIZATION_ID,
      },
    });
    const role = await prisma.role.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: 'ADMIN' } },
      update: { system: true },
      create: { organizationId: organization.id, name: 'ADMIN', system: true },
    });
    await prisma.$transaction((tx) => grantAdminPermissions(tx, role.id));

    const existing = await prisma.user.findUnique({
      where: { organizationId_email: { organizationId: organization.id, email: ADMIN_EMAIL } },
    });
    if (existing) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: existing.id, roleId: role.id } },
        update: {},
        create: { userId: existing.id, roleId: role.id },
      });
      console.log('El administrador ya existe');
      return;
    }

    const password = await readPassword();
    if (!password) throw new Error('La contraseña es obligatoria.');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email: ADMIN_EMAIL,
          passwordHash,
          firstName: 'Wilmer',
          lastName: 'Espinosa',
        },
      });
      await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
    });
    console.log('Administrador creado correctamente');
  } finally {
    await prisma.$disconnect();
  }
}

void main();
