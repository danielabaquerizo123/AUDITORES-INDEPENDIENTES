require('dotenv').config({ path: '.env.test', override: true });
jest.setTimeout(30000);
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');
const { resetUserPassword } = require('../dist/scripts/reset-user-password.js');

describe('reset user password', () => {
  const prisma = new PrismaClient();
  let org;
  let role;
  let user;
  const oldPassword = 'old-password-only';
  const newPassword = 'new-password-only';

  beforeAll(async () => {
    const r = await prisma.$queryRawUnsafe('SELECT current_database() AS name');
    if (r[0].name !== 'sistem_auditoria_test') throw new Error('test DB required');
    org = await prisma.organization.create({ data: { name: `TEST_RESET_PASSWORD_ORG_${Date.now()}` } });
    role = await prisma.role.create({ data: { organizationId: org.id, name: 'ADMIN' } });
    user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: 'test-reset-password@example.test',
        passwordHash: await argon2.hash(oldPassword, { type: argon2.argon2id }),
        firstName: 'Reset',
        lastName: 'User',
        status: 'ACTIVE',
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  });

  afterAll(async () => {
    if (user) await prisma.userRole.deleteMany({ where: { userId: user.id } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    if (role) await prisma.role.delete({ where: { id: role.id } });
    if (org) await prisma.organization.delete({ where: { id: org.id } });
    await prisma.$disconnect();
  });

  test('rejects missing environment, missing organization, and missing user', async () => {
    await expect(resetUserPassword(prisma, {})).rejects.toThrow('RESET_EMAIL is required');
    await expect(resetUserPassword(prisma, {
      RESET_EMAIL: user.email,
      RESET_PASSWORD: newPassword,
      RESET_ORGANIZATION_ID: 'missing',
    })).rejects.toThrow('Organization not found');
    await expect(resetUserPassword(prisma, {
      RESET_EMAIL: 'missing@example.test',
      RESET_PASSWORD: newPassword,
      RESET_ORGANIZATION_ID: org.id,
    })).rejects.toThrow('User not found');
  });

  test('resets password hash and preserves user data', async () => {
    const before = await prisma.user.findUnique({ where: { id: user.id } });
    const beforeRoles = await prisma.userRole.findMany({ where: { userId: user.id }, orderBy: { roleId: 'asc' } });

    const result = await resetUserPassword(prisma, {
      RESET_EMAIL: 'TEST-RESET-PASSWORD@EXAMPLE.TEST',
      RESET_PASSWORD: newPassword,
      RESET_ORGANIZATION_ID: org.id,
    });

    const after = await prisma.user.findUnique({ where: { id: user.id } });
    const afterRoles = await prisma.userRole.findMany({ where: { userId: user.id }, orderBy: { roleId: 'asc' } });

    expect(result.id).toBe(user.id);
    expect(after.passwordHash).not.toBe(before.passwordHash);
    expect(await argon2.verify(after.passwordHash, newPassword)).toBe(true);
    expect(await argon2.verify(after.passwordHash, oldPassword)).toBe(false);
    expect({
      id: after.id,
      organizationId: after.organizationId,
      email: after.email,
      firstName: after.firstName,
      lastName: after.lastName,
      status: after.status,
      lastLoginAt: after.lastLoginAt,
      createdAt: after.createdAt,
      deletedAt: after.deletedAt,
    }).toEqual({
      id: before.id,
      organizationId: before.organizationId,
      email: before.email,
      firstName: before.firstName,
      lastName: before.lastName,
      status: before.status,
      lastLoginAt: before.lastLoginAt,
      createdAt: before.createdAt,
      deletedAt: before.deletedAt,
    });
    expect(afterRoles).toEqual(beforeRoles);
  });
});
