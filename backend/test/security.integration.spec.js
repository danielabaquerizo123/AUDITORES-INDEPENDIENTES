require('dotenv').config({ path: '.env.test', override: true });
const request = require('supertest');
const argon2 = require('argon2');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { AppModule } = require('../dist/src/app.module.js');
const { HttpExceptionFilter } = require('../dist/src/common/filters/http-exception.filter.js');
const { PrismaService } = require('../dist/src/database/prisma.service.js');

describe('HTTP authentication and RBAC', () => {
  let app; let prisma; let jwt; let org; let admin; let reader; let none; let disabled; let client; let adminToken; let readerToken; let noneToken;
  const password = 'fixture-password-only';
  const keys = ['clients.read', 'clients.create', 'clients.update', 'periods.read', 'periods.create', 'contracts.read', 'contracts.create'];

  const createUser = async (role, email, status = 'ACTIVE') => prisma.user.create({ data: { organizationId: org.id, email, passwordHash: await argon2.hash(password, { type: argon2.argon2id }), firstName: 'Test', lastName: role.name, status, roles: { create: { roleId: role.id } } } });
  const login = async (email) => (await request(app.getHttpServer()).post('/api/auth/login').send({ email, password }).expect(201)).body.accessToken;

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL?.includes('sistem_auditoria_test') || !process.env.DATABASE_URL?.includes('sistem_auditoria_test')) throw new Error('Integration tests require sistem_auditoria_test');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = moduleRef.createNestApplication(); app.setGlobalPrefix('api'); app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })); app.useGlobalFilters(new HttpExceptionFilter()); await app.init(); prisma = app.get(PrismaService); jwt = app.get(JwtService);
    expect((await prisma.$queryRawUnsafe('SELECT current_database() AS name'))[0].name).toBe('sistem_auditoria_test');
    org = await prisma.organization.create({ data: { name: 'TEST HTTP Organization A' } });
    for (const key of keys) await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
    const permissions = await prisma.permission.findMany({ where: { key: { in: keys } } }); const byKey = Object.fromEntries(permissions.map((item) => [item.key, item.id]));
    const adminRole = await prisma.role.create({ data: { organizationId: org.id, name: 'TEST_ADMIN', permissions: { create: permissions.map((item) => ({ permissionId: item.id })) } } });
    const readerRole = await prisma.role.create({ data: { organizationId: org.id, name: 'TEST_READER', permissions: { create: ['clients.read', 'periods.read', 'contracts.read'].map((key) => ({ permissionId: byKey[key] })) } } });
    const noneRole = await prisma.role.create({ data: { organizationId: org.id, name: 'TEST_NONE' } });
    admin = await createUser(adminRole, 'test-http-admin@example.test'); reader = await createUser(readerRole, 'test-http-reader@example.test'); none = await createUser(noneRole, 'test-http-none@example.test'); disabled = await createUser(adminRole, 'test-http-disabled@example.test', 'INACTIVE');
    client = await prisma.client.create({ data: { organizationId: org.id, legalName: 'TEST HTTP Client', taxId: `HTTP-${org.id}`, country: 'EC' } });
    adminToken = await login(admin.email); readerToken = await login(reader.email); noneToken = await login(none.email);
  });

  afterAll(async () => { if (org) { await prisma.auditLog.deleteMany({ where: { organizationId: org.id } }); await prisma.auditPeriod.deleteMany({ where: { client: { organizationId: org.id } } }); await prisma.client.deleteMany({ where: { organizationId: org.id } }); await prisma.userRole.deleteMany({ where: { user: { organizationId: org.id } } }); await prisma.user.deleteMany({ where: { organizationId: org.id } }); await prisma.rolePermission.deleteMany({ where: { role: { organizationId: org.id } } }); await prisma.role.deleteMany({ where: { organizationId: org.id } }); await prisma.organization.delete({ where: { id: org.id } }); } await app?.close(); });

  test('login accepts valid credentials without exposing password data', async () => { const response = await request(app.getHttpServer()).post('/api/auth/login').send({ email: admin.email, password }).expect(201); expect(response.body.accessToken).toBeTruthy(); expect(response.body).not.toHaveProperty('passwordHash'); });
  test('login rejects invalid, missing, and disabled users', async () => { await request(app.getHttpServer()).post('/api/auth/login').send({ email: admin.email, password: 'wrong' }).expect(401); await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'absent@example.test', password }).expect(401); await request(app.getHttpServer()).post('/api/auth/login').send({ email: disabled.email, password }).expect(401); });
  test('auth me differentiates missing, invalid, expired, and valid tokens', async () => { await request(app.getHttpServer()).get('/api/auth/me').expect(401); await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', 'Bearer invalid').expect(401); const expired = await jwt.signAsync({ sub: admin.id, organizationId: org.id }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: -1 }); await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${expired}`).expect(401); const response = await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${adminToken}`).expect(200); expect(response.body).toEqual(expect.objectContaining({ id: admin.id, email: admin.email, organization: expect.any(Object), roles: expect.any(Array), permissions: expect.any(Array) })); expect(response.body).not.toHaveProperty('passwordHash'); });
  test('disabled user token is rejected after issuance', async () => { const token = await jwt.signAsync({ sub: reader.id, organizationId: org.id }, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' }); await prisma.user.update({ where: { id: reader.id }, data: { status: 'INACTIVE' } }); await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(401); await prisma.user.update({ where: { id: reader.id }, data: { status: 'ACTIVE' } }); });
  test('clients enforce 401, read, and create permissions', async () => { await request(app.getHttpServer()).get('/api/clients').expect(401); await request(app.getHttpServer()).get('/api/clients').set('Authorization', `Bearer ${adminToken}`).expect(200); await request(app.getHttpServer()).get('/api/clients').set('Authorization', `Bearer ${noneToken}`).expect(403); await request(app.getHttpServer()).post('/api/clients').set('Authorization', `Bearer ${readerToken}`).send({ legalName: 'Denied', taxId: 'DENIED', country: 'EC' }).expect(403); const response = await request(app.getHttpServer()).post('/api/clients').set('Authorization', `Bearer ${adminToken}`).send({ legalName: 'Created HTTP Client', taxId: `CREATED-${org.id}`, economicActivity: 'Servicios profesionales', email: 'created-http@example.test', country: 'EC', representative: { treatment: 'Sra.', fullName: 'TEST Creadora HTTP', nationalId: '0012345678', position: 'Gerente General' } }).expect(201); await prisma.client.delete({ where: { id: response.body.id } }); });
  test('period and contract guards deny reader writes and no-permission reads', async () => { await request(app.getHttpServer()).post(`/api/clients/${client.id}/audit-periods`).set('Authorization', `Bearer ${readerToken}`).send({ label: 'Denied', fiscalYear: 2027, startDate: '2027-01-01', endDate: '2027-12-31' }).expect(403); await request(app.getHttpServer()).get('/api/contracts').set('Authorization', `Bearer ${readerToken}`).expect(200); await request(app.getHttpServer()).get('/api/contracts').set('Authorization', `Bearer ${noneToken}`).expect(403); });
});
