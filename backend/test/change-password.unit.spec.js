const argon2 = require('argon2');
const { AuthService } = require('../dist/src/auth/auth.service.js');

const currentPassword = 'Actual123!';
const validPassword = 'Nueva123!';

async function serviceFor(passwordHash) {
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1', passwordHash }), update: jest.fn().mockResolvedValue({}) } };
  return { service: new AuthService(prisma, {}), prisma };
}

describe('change password', () => {
  test('rejects an incorrect current password', async () => {
    const { service, prisma } = await serviceFor(await argon2.hash(currentPassword));
    await expect(service.changePassword('user-1', { currentPassword: 'Incorrecta123!', newPassword: validPassword, confirmPassword: validPassword })).rejects.toThrow('La contraseña actual es incorrecta.');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('rejects a mismatched confirmation', async () => {
    const { service, prisma } = await serviceFor(await argon2.hash(currentPassword));
    await expect(service.changePassword('user-1', { currentPassword, newPassword: validPassword, confirmPassword: 'Otra123!' })).rejects.toThrow('La confirmación de contraseña no coincide.');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('rejects an invalid new password', async () => {
    const { service, prisma } = await serviceFor(await argon2.hash(currentPassword));
    await expect(service.changePassword('user-1', { currentPassword, newPassword: 'invalida', confirmPassword: 'invalida' })).rejects.toThrow('La nueva contraseña no cumple los requisitos de seguridad.');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test('updates only the authenticated user with an Argon2id hash', async () => {
    const { service, prisma } = await serviceFor(await argon2.hash(currentPassword));
    await expect(service.changePassword('user-1', { currentPassword, newPassword: validPassword, confirmPassword: validPassword })).resolves.toEqual({ success: true });
    const call = prisma.user.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'user-1' });
    expect(call.data.passwordHash).toMatch(/^\$argon2id\$/);
    await expect(argon2.verify(call.data.passwordHash, validPassword)).resolves.toBe(true);
  });
});
