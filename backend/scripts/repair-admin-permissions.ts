import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { grantAdminPermissions } from '../src/auth/admin-permissions';
async function main() {
 const prisma = new PrismaClient();
 try {
  const roles = await prisma.role.findMany({ where: { name: 'ADMIN', users: { some: { user: { status: 'ACTIVE', deletedAt: null } } } }, select: { id: true } });
  for (const role of roles) await prisma.$transaction(tx => grantAdminPermissions(tx, role.id));
  console.log(`Permisos ADMIN reparados: ${roles.length} rol(es). No se cambiaron credenciales.`);
 } finally { await prisma.$disconnect(); }
}
void main();
