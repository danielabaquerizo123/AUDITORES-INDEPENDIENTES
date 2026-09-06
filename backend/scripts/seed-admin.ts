import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { createInterface } from 'readline';
import { grantAdminPermissions } from '../src/auth/admin-permissions';

const ORGANIZATION_ID = 'development-organization';

function readEmail(): Promise<string> {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    readline.question('Usuario/correo: ', (value) => {
      readline.close();
      resolve(value);
    });
  });
}

function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('Se requiere una terminal interactiva.');

  process.stdout.write(prompt);
  return new Promise((resolve) => {
    let value = '';
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
          resolve(value);
          return;
        }
        if (byte === 127 || byte === 8) {
          value = value.slice(0, -1);
          continue;
        }
        value += Buffer.from([byte]).toString();
      }
    });
  });
}

async function main() {
  const email = (await readEmail()).trim().toLowerCase();
  const password = await readHidden('Contraseña: ');
  if (!email || !password) throw new Error('Usuario/correo y contraseña son obligatorios.');

  const prisma = new PrismaClient();
  try {
    const organization = await prisma.organization.upsert({
      where: { id: ORGANIZATION_ID },
      update: {},
      create: { id: ORGANIZATION_ID, name: ORGANIZATION_ID, legalName: ORGANIZATION_ID },
    });
    const role = await prisma.role.upsert({
      where: { organizationId_name: { organizationId: organization.id, name: 'ADMIN' } },
      update: { system: true },
      create: { organizationId: organization.id, name: 'ADMIN', system: true },
    });
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    await prisma.$transaction(async (tx) => {
      await grantAdminPermissions(tx, role.id);
      const existing = await tx.user.findUnique({
        where: { organizationId_email: { organizationId: organization.id, email } },
      });
      const user = existing
        ? await tx.user.update({ where: { id: existing.id }, data: { passwordHash } })
        : await tx.user.create({
            data: {
              organizationId: organization.id,
              email,
              passwordHash,
              firstName: 'Wilmer',
              lastName: 'Espinosa',
            },
          });
      await tx.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    });
    console.log('Administrador configurado correctamente');
  } finally {
    await prisma.$disconnect();
  }
}

void main();
