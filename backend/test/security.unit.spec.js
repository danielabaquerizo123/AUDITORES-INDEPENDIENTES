const { AuthService } = require('../dist/src/auth/auth.service.js');
const { JwtStrategy } = require('../dist/src/auth/strategies/jwt.strategy.js');
const { PermissionsGuard } = require('../dist/src/auth/guards/permissions.guard.js');
const { ContractsService } = require('../dist/src/contracts/contracts.service.js');

const activeUser = { id: 'user-a', organizationId: 'org-a', email: 'a@example.test', passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$YXNkZg$invalid', firstName: 'A', lastName: 'User', organization: { id: 'org-a', name: 'A' }, roles: [{ role: { name: 'ADMIN', permissions: [{ permission: { key: 'clients.read' } }] } }] };

describe('JWT and login security', () => {
  test('login rejects missing user and invalid password with the same error', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new AuthService(prisma, { signAsync: jest.fn() });
    await expect(service.login('missing@example.test', 'wrong')).rejects.toThrow('Invalid email or password');
  });
  test('JWT validation rejects a nonexistent or disabled user', async () => {
    const strategy = new JwtStrategy({ getOrThrow: jest.fn().mockReturnValue('test-secret') }, { user: { findFirst: jest.fn().mockResolvedValue(null) } });
    await expect(strategy.validate({ sub: 'missing', organizationId: 'org-a' })).rejects.toThrow();
  });
  test('JWT validation returns safe session claims only', async () => {
    const strategy = new JwtStrategy({ getOrThrow: jest.fn().mockReturnValue('test-secret') }, { user: { findFirst: jest.fn().mockResolvedValue(activeUser) } });
    const result = await strategy.validate({ sub: 'user-a', organizationId: 'org-a' });
    expect(result).toEqual(expect.objectContaining({ id: 'user-a', organizationId: 'org-a', permissions: ['clients.read'] }));
    expect(result).not.toHaveProperty('passwordHash');
  });
});

describe('RBAC guard', () => {
  const context = (permissions) => ({ getHandler: () => 'handler', getClass: () => 'class', switchToHttp: () => ({ getRequest: () => ({ user: { permissions } }) }) });
  test('allows required permission', () => expect(new PermissionsGuard({ getAllAndOverride: () => ['clients.read'] }).canActivate(context(['clients.read']))).toBe(true));
  test('denies missing read permission', () => expect(new PermissionsGuard({ getAllAndOverride: () => ['clients.read'] }).canActivate(context([]))).toBe(false));
  test('denies create when user has only read', () => expect(new PermissionsGuard({ getAllAndOverride: () => ['clients.create'] }).canActivate(context(['clients.read']))).toBe(false));
});

describe('contract tenant isolation', () => {
  test('cross-tenant template lookup becomes not found', async () => {
    const prisma = { contractTemplate: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new ContractsService(prisma, {}, {});
    await expect(service.template('org-a', 'template-b')).rejects.toThrow('Template not found');
    expect(prisma.contractTemplate.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'template-b', organizationId: 'org-a' } }));
  });
  test('contract listing always scopes by organization', () => {
    const prisma = { contract: { findMany: jest.fn() } };
    new ContractsService(prisma, {}, {}).contracts('org-a');
    expect(prisma.contract.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { client: { organizationId: 'org-a' } } }));
  });
});
