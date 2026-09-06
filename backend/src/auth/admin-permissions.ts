import { Prisma } from '@prisma/client';

export const ADMIN_PERMISSION_KEYS = [
 'clients.read', 'clients.create', 'clients.update', 'clients.delete', 'periods.read', 'periods.create', 'periods.update',
 'contracts.read', 'contracts.create', 'contracts.update', 'contracts.approve', 'contracts.generate',
 'documents.read', 'documents.generate', 'users.read', 'users.manage', 'audit.read',
 'financial.read', 'financial.import', 'financial.update',
];
/** Persist actual RBAC grants; never bypass the permission guard. */
export async function grantAdminPermissions(tx: Prisma.TransactionClient, roleId: string) {
 for (const key of ADMIN_PERMISSION_KEYS) {
  const permission = await tx.permission.upsert({ where: { key }, update: {}, create: { key } });
  await tx.rolePermission.upsert({ where: { roleId_permissionId: { roleId, permissionId: permission.id } }, update: {}, create: { roleId, permissionId: permission.id } });
 }
}
