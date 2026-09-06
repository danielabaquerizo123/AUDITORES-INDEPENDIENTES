require('dotenv').config({ path: '.env.test', override: true });
jest.setTimeout(60000);
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/src/app.module.js');
const { HttpExceptionFilter } = require('../dist/src/common/filters/http-exception.filter.js');
const { PrismaService } = require('../dist/src/database/prisma.service.js');
const { createTenantFixtures, cleanupTenantFixtures, assertTestDatabase } = require('./helpers/tenant-fixtures');

/**
 * Golden test with a controlled technical fixture. No real client data.
 */
describe('contract golden preview', () => {
  let app;
  let prisma;
  let f;
  let token;
  const extra = { periods: [], clients: [], contracts: [], templates: [] };
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    await assertTestDatabase(prisma);
    f = await createTenantFixtures(prisma);
    token = (await api().post('/api/auth/login').send({ email: f.userAdminA.email, password: f.password }).expect(201)).body.accessToken;
  });

  afterAll(async () => {
    if (extra.contracts.length > 0) await prisma.contract.deleteMany({ where: { id: { in: extra.contracts } } });
    if (extra.templates.length > 0) await prisma.contractTemplate.deleteMany({ where: { id: { in: extra.templates } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [f.organizationA.id, f.organizationB.id] } } });
    if (extra.periods.length > 0) await prisma.auditPeriod.deleteMany({ where: { id: { in: extra.periods } } });
    if (extra.clients.length > 0) await prisma.client.deleteMany({ where: { id: { in: extra.clients } } });
    if (f) await cleanupTenantFixtures(prisma, f);
    await app.close();
  });

  test('renders every semantic variable of the golden fixture', async () => {
    const client = await prisma.client.create({
      data: { organizationId: f.organizationA.id, legalName: 'Empresa Ejemplo S.A.', taxId: '1790000000001', country: 'EC', email: 'contacto@ejemplo.test' },
    });
    extra.clients.push(client.id);
    await prisma.clientRepresentative.create({
      data: { clientId: client.id, fullName: 'Representante Test', nationalId: '1700000001', position: 'Gerente General', isPrimary: true },
    });
    const period = await prisma.auditPeriod.create({
      data: { clientId: client.id, label: 'Auditoría 2025', fiscalYear: 2025, startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31') },
    });
    extra.periods.push(period.id);
    const template = (
      await api()
        .post('/api/contract-templates')
        .set(auth())
        .send({
          name: `TEST Golden ${f.suffix}`,
          clauses: [
            { clauseKey: 'comparecientes', title: 'Comparecientes', body: '{{company.legalName}} con RUC {{company.ruc}}, representada por {{representative.name}} con identificación {{representative.identification}}, {{representative.position}}.', sortOrder: 1 },
            { clauseKey: 'objeto', title: 'Objeto', body: 'Auditoría del ejercicio {{audit.year}} ({{audit.label}}) del {{audit.periodStart}} al {{audit.periodEnd}}.', sortOrder: 2 },
            { clauseKey: 'honorarios', title: 'Honorarios', body: 'Honorarios {{contract.fee}} {{contract.currency}} ({{contract.feeWords}}), contrato {{contract.number}} firmado el {{contract.signingDate}}.', sortOrder: 3 },
          ],
        })
        .expect(201)
    ).body;
    extra.templates.push(template.id);
    const contract = (
      await api()
        .post(`/api/audit-periods/${period.id}/contracts`)
        .set(auth())
        .send({ templateId: template.id, contractNumber: 'GOLD-2025', signingDate: '2025-02-01', effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31', feeNet: '1500', currency: 'USD' })
        .expect(201)
    ).body;
    extra.contracts.push(contract.id);

    const preview = (await api().get(`/api/contracts/${contract.id}/preview`).set(auth()).expect(200)).body;
    expect(preview.validation.valid).toBe(true);
    const joined = preview.sections.map((s) => `${s.title} ${s.body}`).join('\n');
    expect(joined).toContain('Empresa Ejemplo S.A.');
    expect(joined).toContain('1790000000001');
    expect(joined).toContain('Representante Test');
    expect(joined).toContain('1700000001');
    expect(joined).toContain('Gerente General');
    expect(joined).toContain('2025');
    expect(joined).toContain('Auditoría 2025');
    expect(joined).toContain('2025-01-01');
    expect(joined).toContain('2025-12-31');
    expect(joined).toContain('1500');
    expect(joined).toContain('Mil quinientos dólares americanos con 00/100');
    expect(joined).toContain('GOLD-2025');
    expect(joined).toContain('2025-02-01');
    expect(joined).not.toMatch(/{{[\w.]+}}/);
  });
});
