const { AuthService } = require('../dist/src/auth/auth.service.js');
const { AuthController } = require('../dist/src/auth/auth.controller.js');
const argon2 = require('argon2');

const user = {
  id: 'user-1', organizationId: 'org-1', email: 'user@example.test', passwordHash: '', firstName: 'Test', lastName: 'User',
  organization: { id: 'org-1', name: 'Org' },
  roles: [{ role: { name: 'ADMIN', permissions: [{ permission: { key: 'clients.create' } }] } }],
};

describe('renewable auth session', () => {
  const priorEnv = { access: process.env.JWT_ACCESS_SECRET, refresh: process.env.JWT_REFRESH_SECRET };
  beforeAll(() => { process.env.JWT_ACCESS_SECRET = 'a'.repeat(40); process.env.JWT_REFRESH_SECRET = 'r'.repeat(40); });
  afterAll(() => {
    if (priorEnv.access === undefined) delete process.env.JWT_ACCESS_SECRET; else process.env.JWT_ACCESS_SECRET = priorEnv.access;
    if (priorEnv.refresh === undefined) delete process.env.JWT_REFRESH_SECRET; else process.env.JWT_REFRESH_SECRET = priorEnv.refresh;
  });

  test('login issues a 15 minute access token and a 7 day refresh token separately', async () => {
    user.passwordHash = await argon2.hash('Valid123!');
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(user), update: jest.fn().mockResolvedValue({}) } };
    const jwt = { signAsync: jest.fn().mockResolvedValueOnce('access-jwt').mockResolvedValueOnce('refresh-jwt') };
    const service = new AuthService(prisma, jwt);
    await expect(service.login(user.email, 'Valid123!')).resolves.toEqual(expect.objectContaining({ accessToken: 'access-jwt', refreshToken: 'refresh-jwt' }));
    expect(jwt.signAsync.mock.calls[0][1]).toEqual(expect.objectContaining({ expiresIn: '15m', secret: process.env.JWT_ACCESS_SECRET }));
    expect(jwt.signAsync.mock.calls[1][1]).toEqual(expect.objectContaining({ expiresIn: '7d', secret: process.env.JWT_REFRESH_SECRET }));
  });

  test('a valid refresh verifies the refresh secret and returns a new access token only', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(user) } };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: user.id, organizationId: user.organizationId, tokenUse: 'refresh' }), signAsync: jest.fn().mockResolvedValue('new-access') };
    const service = new AuthService(prisma, jwt);
    await expect(service.refresh('valid-refresh')).resolves.toEqual({ accessToken: 'new-access' });
    expect(jwt.verifyAsync).toHaveBeenCalledWith('valid-refresh', { secret: process.env.JWT_REFRESH_SECRET });
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: user.id, organizationId: user.organizationId, status: 'ACTIVE', deletedAt: null } }));
  });

  test('invalid, expired, wrong-purpose, or unavailable-user refresh tokens are rejected', async () => {
    const invalidJwt = new AuthService({ user: { findFirst: jest.fn() } }, { verifyAsync: jest.fn().mockRejectedValue(new Error('expired')) });
    await expect(invalidJwt.refresh('expired')).rejects.toThrow('La sesión renovable no es válida.');
    const wrongPurpose = new AuthService({ user: { findFirst: jest.fn() } }, { verifyAsync: jest.fn().mockResolvedValue({ sub: 'u', organizationId: 'o', tokenUse: 'access' }) });
    await expect(wrongPurpose.refresh('wrong-purpose')).rejects.toThrow('La sesión renovable no es válida.');
    const missingUser = new AuthService({ user: { findFirst: jest.fn().mockResolvedValue(null) } }, { verifyAsync: jest.fn().mockResolvedValue({ sub: 'u', organizationId: 'o', tokenUse: 'refresh' }) });
    await expect(missingUser.refresh('disabled-user')).rejects.toThrow('La sesión renovable no es válida.');
  });

  test('login sets an HttpOnly refresh cookie and logout clears that cookie with matching options', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const auth = { login: jest.fn().mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh', user: { id: user.id } }), refresh: jest.fn().mockResolvedValue({ accessToken: 'renewed' }) };
    const controller = new AuthController(auth);
    const response = { cookie: jest.fn(), clearCookie: jest.fn() };
    await expect(controller.login({ email: user.email, password: 'unused' }, response)).resolves.toEqual({ accessToken: 'access', user: { id: user.id } });
    expect(response.cookie).toHaveBeenCalledWith('refreshToken', 'refresh', expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'none', path: '/api/auth', maxAge: 604800000 }));
    await controller.refresh({ headers: { cookie: 'other=1; refreshToken=renew%2Ftoken' } });
    expect(auth.refresh).toHaveBeenCalledWith('renew/token');
    controller.logout(response);
    expect(response.clearCookie).toHaveBeenCalledWith('refreshToken', expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'none', path: '/api/auth' }));
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalNodeEnv;
  });

  test('an invalid refresh cookie is cleared before the unauthorized response is returned', async () => {
    const controller = new AuthController({ refresh: jest.fn().mockRejectedValue(new (require('@nestjs/common').UnauthorizedException)('invalid')) });
    const response = { clearCookie: jest.fn() };
    await expect(controller.refresh({ headers: { cookie: 'refreshToken=invalid' } }, response)).rejects.toThrow('invalid');
    expect(response.clearCookie).toHaveBeenCalledWith('refreshToken', expect.objectContaining({ httpOnly: true, path: '/api/auth' }));
  });
});
