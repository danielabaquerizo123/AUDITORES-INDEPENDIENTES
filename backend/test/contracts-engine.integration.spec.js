require('dotenv').config({ path: '.env.test', override: true });
jest.setTimeout(60000);
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/src/app.module.js');
const { HttpExceptionFilter } = require('../dist/src/common/filters/http-exception.filter.js');
const { PrismaService } = require('../dist/src/database/prisma.service.js');
const { createTenantFixtures, cleanupTenantFixtures, assertTestDatabase } = require('./helpers/tenant-fixtures');

describe('contract engine endpoints', () => {
  let app;
  let prisma;
  let f;
  let token;
  const extra = { periods: [], clients: [], contracts: [], templates: [], documents: [] };
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const api = () => request(app.getHttpServer());

  async function loginAs(user, password) {
    return (await api().post('/api/auth/login').send({ email: user.email, password }).expect(201)).body.accessToken;
  }

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
    const generate = await prisma.permission.upsert({ where: { key: 'contracts.generate' }, update: {}, create: { key: 'contracts.generate' } });
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: f.roleA.id, permissionId: generate.id } },
      update: {},
      create: { roleId: f.roleA.id, permissionId: generate.id },
    });
    token = await loginAs(f.userAdminA, f.password);
  });

  afterAll(async () => {
    for (const doc of extra.documents) {
      try {
        if (doc.storageKey) {
          const file = path.join(__dirname, '..', '..', 'storage', 'generated', doc.storageKey);
          if (fs.existsSync(file)) fs.unlinkSync(file);
        }
      } catch { /* best effort cleanup */ }
    }
    if (extra.documents.length > 0) await prisma.generatedDocument.deleteMany({ where: { id: { in: extra.documents.map((d) => d.id) } } });
    if (extra.contracts.length > 0) await prisma.contract.deleteMany({ where: { id: { in: extra.contracts } } });
    if (extra.templates.length > 0) await prisma.contractTemplate.deleteMany({ where: { id: { in: extra.templates } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [f.organizationA.id, f.organizationB.id] } } });
    if (extra.periods.length > 0) await prisma.auditPeriod.deleteMany({ where: { id: { in: extra.periods } } });
    if (extra.clients.length > 0) await prisma.client.deleteMany({ where: { id: { in: extra.clients } } });
    if (f) await cleanupTenantFixtures(prisma, f);
    await app.close();
  });

  test('A. builds context from real tenant data', async () => {
    const res = await api().get(`/api/contracts/${f.contractA.id}/context`).set(auth()).expect(200);
    expect(res.body.context.company.legalName).toBe(f.clientA.legalName);
    expect(res.body.context.company.ruc).toBe(f.clientA.taxId);
    expect(res.body.context.audit.year).toBe(2031);
    expect(res.body.context.representative.name).toBe('TEST Representative A');
  });

  test('B. blocks contracts without a primary representative', async () => {
    const repTemplate = (await api().post('/api/contract-templates').set(auth()).send({ name: `TEST Rep ${f.suffix}`, clauses: [{ clauseKey: 'rep', title: 'Representante', body: 'Representada por {{representative.name}}.', sortOrder: 1 }] }).expect(201)).body;
    extra.templates.push(repTemplate.id);
    const client = await prisma.client.create({ data: { organizationId: f.organizationA.id, legalName: 'TEST No Rep', taxId: `NOREP-${f.suffix}`, country: 'EC' } });
    extra.clients.push(client.id);
    const period = await prisma.auditPeriod.create({ data: { clientId: client.id, label: 'TEST No Rep Period', fiscalYear: 2032, startDate: new Date('2032-01-01'), endDate: new Date('2032-12-31') } });
    extra.periods.push(period.id);
    const contract = (await api().post(`/api/audit-periods/${period.id}/contracts`).set(auth()).send({ templateId: repTemplate.id }).expect(201)).body;
    extra.contracts.push(contract.id);
    const validation = (await api().get(`/api/contracts/${contract.id}/variables/validate`).set(auth()).expect(200)).body;
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('El cliente no tiene un representante principal configurado.');
  });

  test('C. reports unknown variables', async () => {
    const template = (await api().post('/api/contract-templates').set(auth()).send({ name: `TEST Unknown ${f.suffix}`, clauses: [{ clauseKey: 'k', title: 'K', body: 'Hola {{company.legalName}} y {{foo.bar}}', sortOrder: 1 }] }).expect(201)).body;
    extra.templates.push(template.id);
    const period = await prisma.auditPeriod.create({ data: { clientId: f.clientA.id, label: 'TEST Unknown Period', fiscalYear: 2034, startDate: new Date('2034-01-01'), endDate: new Date('2034-12-31') } });
    extra.periods.push(period.id);
    const contract = (await api().post(`/api/audit-periods/${period.id}/contracts`).set(auth()).send({ templateId: template.id }).expect(201)).body;
    extra.contracts.push(contract.id);
    const validation = (await api().get(`/api/contracts/${contract.id}/variables/validate`).set(auth()).expect(200)).body;
    expect(validation.valid).toBe(false);
    expect(validation.unknown).toContain('foo.bar');
    expect(validation.errors).toContain('Variable desconocida: foo.bar');
  });

  test('D. reports required variables without value', async () => {
    const template = (await api().post('/api/contract-templates').set(auth()).send({ name: `TEST Fee ${f.suffix}`, clauses: [{ clauseKey: 'fee', title: 'Honorarios', body: 'Honorarios {{contract.fee}} ({{contract.feeWords}})', sortOrder: 1 }] }).expect(201)).body;
    extra.templates.push(template.id);
    const period = await prisma.auditPeriod.create({ data: { clientId: f.clientA.id, label: 'TEST Fee Period', fiscalYear: 2035, startDate: new Date('2035-01-01'), endDate: new Date('2035-12-31') } });
    extra.periods.push(period.id);
    const contract = (await api().post(`/api/audit-periods/${period.id}/contracts`).set(auth()).send({ templateId: template.id }).expect(201)).body;
    extra.contracts.push(contract.id);
    const validation = (await api().get(`/api/contracts/${contract.id}/variables/validate`).set(auth()).expect(200)).body;
    expect(validation.valid).toBe(false);
    expect(validation.missing).toContain('contract.fee');
  });

  test('E. tenant B cannot access tenant A contracts', async () => {
    const tokenB = await loginAs(f.userAdminB, f.password);
    const authB = { Authorization: `Bearer ${tokenB}` };
    await api().get(`/api/contracts/${f.contractA.id}/preview`).set(authB).expect(404);
    await api().post(`/api/contracts/${f.contractA.id}/documents`).set(authB).send({ format: 'docx' }).expect(403);
    await api().get(`/api/contracts/${f.contractA.id}`).set(authB).expect(404);
  });

  test('F. creation uses createdBy from JWT and rejects spoofed fields', async () => {
    const period = await prisma.auditPeriod.create({ data: { clientId: f.clientA.id, label: 'TEST CreatedBy', fiscalYear: 2036, startDate: new Date('2036-01-01'), endDate: new Date('2036-12-31') } });
    extra.periods.push(period.id);
    const contract = (await api().post(`/api/audit-periods/${period.id}/contracts`).set(auth()).send({ templateId: f.templateA.id, feeNet: '1500', currency: 'USD' }).expect(201)).body;
    extra.contracts.push(contract.id);
    expect(contract.createdById).toBe(f.userAdminA.id);
    expect(contract.updatedById).toBe(f.userAdminA.id);
    await api().post(`/api/audit-periods/${period.id}/contracts`).set(auth()).send({ templateId: f.templateA.id, createdById: f.userAdminB.id }).expect(400);
  });

  test('G. edition uses updatedBy from JWT and keeps snapshot immutable', async () => {
    const updated = (await api().patch(`/api/contracts/${f.contractA.id}`).set(auth()).send({ notes: 'TEST note', status: 'ACTIVE' }).expect(200)).body;
    expect(updated.updatedById).toBe(f.userAdminA.id);
    expect(updated.notes).toBe('TEST note');
    expect(updated.status).toBe('ACTIVE');
    await api().patch(`/api/contracts/${f.contractA.id}`).set(auth()).send({ organizationId: f.organizationB.id }).expect(400);
    await prisma.contractTemplateClause.update({ where: { id: f.templateClauseA.id }, data: { body: 'MUTATED BY TEST' } });
    const reread = (await api().get(`/api/contracts/${f.contractA.id}`).set(auth()).expect(200)).body;
    expect(reread.clauses.map((c) => c.body)).not.toContain('MUTATED BY TEST');
  });

  test('H. resolves contract by audit period', async () => {
    const found = (await api().get(`/api/audit-periods/${f.periodA.id}/contract`).set(auth()).expect(200)).body;
    expect(found.id).toBe(f.contractA.id);
    await api().get('/api/audit-periods/000000000000000000000000/contract').set(auth()).expect(404);
  });

  test('I/J. preview resolves semantic variables without leftover placeholders', async () => {
    const preview = (await api().get(`/api/contracts/${f.contractA.id}/preview`).set(auth()).expect(200)).body;
    const joined = preview.sections.map((s) => `${s.title} ${s.body}`).join('\n');
    expect(joined).toContain('TEST CLAUSE TENANT A');
    expect(joined).not.toMatch(/{{[\w.]+}}/);
    expect(preview.contract.client.legalName).toBe(f.clientA.legalName);
    expect(preview.validation).toBeDefined();
  });

  test('K/L. blocks invalid generation and stores document metadata', async () => {
    const noRepContractId = extra.contracts[0];
    await api().post(`/api/contracts/${noRepContractId}/documents`).set(auth()).send({ format: 'docx' }).expect(400);
    const doc = (await api().post(`/api/contracts/${f.contractA.id}/documents`).set(auth()).send({ format: 'docx' }).expect(201)).body;
    extra.documents.push(doc);
    expect(doc.type).toBe('CONTRACT_DOCX');
    expect(doc.status).toBe('GENERATED');
    expect(doc.contractId).toBe(f.contractA.id);
    expect(doc.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(doc.sizeBytes).toBeGreaterThan(0);
    expect(doc.templateVersion).toBe('1');
    const pdf = (await api().post(`/api/contracts/${f.contractA.id}/documents`).set(auth()).send({ format: 'pdf' }).expect(201)).body;
    extra.documents.push(pdf);
    expect(pdf.type).toBe('CONTRACT_PDF');
    const listed = (await api().get(`/api/contracts/${f.contractA.id}/documents`).set(auth()).expect(200)).body;
    expect(listed.map((d) => d.id)).toEqual(expect.arrayContaining([doc.id, pdf.id]));
    expect(JSON.stringify(listed)).not.toContain('storageKey');
    const download = await api().get(`/api/contracts/${f.contractA.id}/documents/${doc.id}/download`).set(auth()).expect(200);
    expect(download.headers['content-type']).toContain('officedocument');
    expect(download.headers['content-disposition']).toContain('attachment');
  });
});
