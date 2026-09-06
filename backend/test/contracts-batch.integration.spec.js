require('dotenv').config({ path: '.env.test', override: true });
jest.setTimeout(90000);
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/src/app.module.js');
const { HttpExceptionFilter } = require('../dist/src/common/filters/http-exception.filter.js');
const { PrismaService } = require('../dist/src/database/prisma.service.js');
const { createTenantFixtures, cleanupTenantFixtures, assertTestDatabase } = require('./helpers/tenant-fixtures');

describe('fase 4 batch contractual', () => {
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

  async function makeContract({ templateBody, contractPatch = {}, fiscalYear }) {
    const template = (await api().post('/api/contract-templates').set(auth()).send({ name: `TEST Batch ${f.suffix} ${Date.now()} ${Math.random()}`, clauses: [{ clauseKey: 'k', title: 'K', body: templateBody, sortOrder: 1 }] }).expect(201)).body;
    extra.templates.push(template.id);
    const period = await prisma.auditPeriod.create({ data: { clientId: f.clientA.id, label: `TEST Batch ${Date.now()} ${Math.random()}`, fiscalYear, startDate: new Date(`${fiscalYear}-01-01`), endDate: new Date(`${fiscalYear}-12-31`) } });
    extra.periods.push(period.id);
    const contract = (await api().post(`/api/audit-periods/${period.id}/contracts`).set(auth()).send({ templateId: template.id, ...contractPatch }).expect(201)).body;
    extra.contracts.push(contract.id);
    return contract;
  }

  async function waitForJob(id, headers) {
    const deadline = Date.now() + 60000;
    for (;;) {
      const res = await api().get(`/api/contracts/generate-batch/${id}`).set(headers).expect(200);
      if (['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'].includes(res.body.status)) return res.body;
      if (Date.now() > deadline) throw new Error(`batch ${id} did not finish in time`);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
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
    const docs = await prisma.generatedDocument.findMany({ where: { contractId: { in: extra.contracts } } });
    for (const doc of docs) {
      try {
        if (doc.storageKey) {
          const file = path.join(__dirname, '..', '..', 'storage', 'generated', doc.storageKey);
          if (fs.existsSync(file)) fs.unlinkSync(file);
        }
      } catch { /* best effort cleanup */ }
    }
    if (extra.contracts.length > 0) {
      await prisma.generatedDocument.deleteMany({ where: { contractId: { in: extra.contracts } } });
      await prisma.contract.deleteMany({ where: { id: { in: extra.contracts } } });
    }
    if (extra.templates.length > 0) await prisma.contractTemplate.deleteMany({ where: { id: { in: extra.templates } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [f.organizationA.id, f.organizationB.id] } } });
    if (extra.periods.length > 0) await prisma.auditPeriod.deleteMany({ where: { id: { in: extra.periods } } });
    if (extra.clients.length > 0) await prisma.client.deleteMany({ where: { id: { in: extra.clients } } });
    if (f) await cleanupTenantFixtures(prisma, f);
    await app.close();
  });

  test('F. preview individual sigue correcto con fechas persistidas', async () => {
    const contract = await makeContract({
      templateBody: 'Firma {{contract.signingDate}} entrega {{report.deliveryDate}}.',
      contractPatch: { signingDate: '2037-02-01', reportDeliveryDate: '2037-03-15' },
      fiscalYear: 2037,
    });
    const preview = (await api().get(`/api/contracts/${contract.id}/preview`).set(auth()).expect(200)).body;
    expect(preview.validation.valid).toBe(true);
    expect(preview.contract.signingDate).toContain('2037-02-01');
    expect(preview.contract.reportDeliveryDate).toContain('2037-03-15');
    const joined = preview.sections.map((s) => s.body).join('\n');
    expect(joined).toContain('2037-02-01');
    expect(joined).toContain('2037-03-15');
    expect(joined).not.toMatch(/{{[\w.]+}}/);
  });

  test('G. generación DOCX/PDF individual sigue correcta', async () => {
    const contract = await makeContract({
      templateBody: 'Contrato {{contract.number}} {{company.legalName}}.',
      contractPatch: { contractNumber: 'BATCH-G-1' },
      fiscalYear: 2038,
    });
    const docx = (await api().post(`/api/contracts/${contract.id}/documents`).set(auth()).send({ format: 'docx' }).expect(201)).body;
    expect(docx.sha256).toMatch(/^[a-f0-9]{64}$/);
    const pdf = (await api().post(`/api/contracts/${contract.id}/documents`).set(auth()).send({ format: 'pdf' }).expect(201)).body;
    expect(pdf.type).toBe('CONTRACT_PDF');
  });

  test('H. batch con 3 contratos válidos genera 3 éxitos', async () => {
    const made = [];
    for (let i = 0; i < 3; i += 1) {
      made.push(await makeContract({
        templateBody: `Contrato válido ${i} {{company.legalName}}.`,
        fiscalYear: 2040 + i,
      }));
    }
    const started = (await api().post('/api/contracts/generate-batch').set(auth()).send({ contractIds: made.map((c) => c.id), format: 'docx' }).expect(201)).body;
    expect(started.total).toBe(3);
    const finished = await waitForJob(started.id, auth());
    expect(finished.status).toBe('COMPLETED');
    expect(finished.successful).toBe(3);
    expect(finished.failed).toBe(0);
    expect(finished.results).toHaveLength(3);
    for (const result of finished.results) {
      expect(result.status).toBe('SUCCESS');
      expect(result.documentId).toBeTruthy();
    }
    const rows = await prisma.generatedDocument.findMany({ where: { contractId: { in: made.map((c) => c.id) } } });
    expect(rows).toHaveLength(3);
  });

  test('I. batch con válidos + inválido devuelve éxito parcial', async () => {
    const ok = await makeContract({ templateBody: 'Válido {{company.legalName}}.', fiscalYear: 2050 });
    const bad = await makeContract({ templateBody: 'Entrega {{report.deliveryDate}}.', fiscalYear: 2051 });
    const started = (await api().post('/api/contracts/generate-batch').set(auth()).send({ contractIds: [ok.id, bad.id], format: 'pdf' }).expect(201)).body;
    const finished = await waitForJob(started.id, auth());
    expect(finished.status).toBe('COMPLETED_WITH_ERRORS');
    expect(finished.total).toBe(2);
    expect(finished.successful).toBe(1);
    expect(finished.failed).toBe(1);
    const failed = finished.results.find((r) => r.contractId === bad.id);
    expect(failed.status).toBe('FAILED');
    expect(failed.errors.join(' ')).toContain('report.deliveryDate');
    const succeeded = finished.results.find((r) => r.contractId === ok.id);
    expect(succeeded.status).toBe('SUCCESS');
    expect(succeeded.documentId).toBeTruthy();
    // El éxito parcial se conserva aunque haya fallos.
    expect(await prisma.generatedDocument.findFirst({ where: { id: succeeded.documentId } })).toBeTruthy();
  });

  test('J. contrato de otra organización se rechaza antes de encolar', async () => {
    const before = await prisma.auditLog.count({ where: { organizationId: f.organizationA.id, action: 'CONTRACT_BATCH_STARTED' } });
    await api().post('/api/contracts/generate-batch').set(auth()).send({ contractIds: [f.contractB.id], format: 'docx' }).expect(404);
    const after = await prisma.auditLog.count({ where: { organizationId: f.organizationA.id, action: 'CONTRACT_BATCH_STARTED' } });
    expect(after).toBe(before);
  });

  test('K. sin contracts.generate el batch es 403', async () => {
    const role = await prisma.role.create({ data: { organizationId: f.organizationA.id, name: `TEST_NOGEN_${f.suffix}` } });
    const read = await prisma.permission.findUnique({ where: { key: 'contracts.read' } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: read.id } });
    const argon2 = require('argon2');
    const user = await prisma.user.create({
      data: { organizationId: f.organizationA.id, email: `nogen-${f.suffix}@example.test`, passwordHash: await argon2.hash('nogen-pass'), firstName: 'No', lastName: 'Gen', roles: { create: { roleId: role.id } } },
    });
    const limited = await loginAs(user, 'nogen-pass');
    const limitedAuth = { Authorization: `Bearer ${limited}` };
    await api().post('/api/contracts/generate-batch').set(limitedAuth).send({ contractIds: [f.contractA.id], format: 'docx' }).expect(403);
    await api().get('/api/contracts/generate-batch/some-id').set(limitedAuth).expect(403);
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.role.delete({ where: { id: role.id } });
  });

  test('L/M. GeneratedDocument y AuditLog por cada éxito del batch', async () => {
    const made = await makeContract({ templateBody: 'Auditable {{company.legalName}}.', fiscalYear: 2052 });
    const started = (await api().post('/api/contracts/generate-batch').set(auth()).send({ contractIds: [made.id], format: 'docx' }).expect(201)).body;
    const finished = await waitForJob(started.id, auth());
    expect(finished.successful).toBe(1);
    const row = await prisma.generatedDocument.findFirst({ where: { id: finished.results[0].documentId } });
    expect(row.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(row.templateVersion).toBeTruthy();
    expect(row.variablesSnapshot).toBeTruthy();
    expect(row.generatedById).toBe(f.userAdminA.id);
    expect(row.generatedAt).toBeTruthy();
    expect(row.storageKey).toBeTruthy();
    expect(row.mimeType).toContain('officedocument');
    expect(Number(row.sizeBytes)).toBeGreaterThan(0);
    const logs = await prisma.auditLog.findMany({ where: { organizationId: f.organizationA.id, entityId: started.id } });
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(['CONTRACT_BATCH_STARTED', 'CONTRACT_BATCH_FINISHED']));
    const docLog = await prisma.auditLog.findFirst({ where: { organizationId: f.organizationA.id, action: 'CONTRACT_DOCX_GENERATED', entityId: row.id } });
    expect(docLog).toBeTruthy();
    expect(JSON.stringify(docLog)).not.toContain('Entrega');
  });

  test('N. doble solicitud idéntica devuelve el mismo job', async () => {
    const made = await makeContract({ templateBody: 'Idempotente {{company.legalName}}.', fiscalYear: 2053 });
    const payload = { contractIds: [made.id], format: 'docx' };
    const first = (await api().post('/api/contracts/generate-batch').set(auth()).send(payload).expect(201)).body;
    const second = (await api().post('/api/contracts/generate-batch').set(auth()).send(payload).expect(201)).body;
    expect(second.id).toBe(first.id);
    const finished = await waitForJob(first.id, auth());
    expect(finished.total).toBe(1);
  });
});
