require('dotenv').config({ path: '.env.test', override: true });
jest.setTimeout(90000);
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const XLSX = require('xlsx');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/src/app.module.js');
const { HttpExceptionFilter } = require('../dist/src/common/filters/http-exception.filter.js');
const { PrismaService } = require('../dist/src/database/prisma.service.js');
const { createTenantFixtures, cleanupTenantFixtures, assertTestDatabase } = require('./helpers/tenant-fixtures');

function workbook(sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of sheets) {
    wb.SheetNames.push(name);
    wb.Sheets[name] = XLSX.utils.aoa_to_sheet(aoa);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function balancedWithExtra(extraLabel) {
  return workbook([['Situación', [
    ['ESTADO DE SITUACIÓN FINANCIERA'],
    ['Cuenta', '2025', '2024'],
    ['TOTAL DE ACTIVOS', 5100, 4990],
    ['TOTAL DEL PASIVO', 3000, 2900],
    ['TOTAL PATRIMONIO', 2100, 2090],
    [extraLabel, 100, 90],
  ]]]);
}

describe('fase 5 reclasificacion manual', () => {
  let app;
  let prisma;
  let f;
  let token;
  const extra = { imports: [] };
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const api = () => request(app.getHttpServer());

  async function loginAs(user, password) {
    return (await api().post('/api/auth/login').send({ email: user.email, password }).expect(201)).body.accessToken;
  }

  async function importProcessed(buffer) {
    const created = (await api().post(`/api/audit-periods/${f.periodA.id}/financial-imports`).set(auth()).attach('file', buffer, 'estados.xlsx').expect(201)).body;
    extra.imports.push(created.id);
    const processed = (await api().post(`/api/financial-imports/${created.id}/process`).set(auth()).expect(201)).body;
    const statements = (await api().get(`/api/financial-imports/${created.id}/statements`).set(auth()).expect(200)).body;
    return { importId: created.id, status: processed.status, statements };
  }

  function linesOf(statements, type) {
    return statements.find((s) => s.type === type).lines;
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
    for (const key of ['financial.read', 'financial.import', 'financial.update']) {
      const permission = await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: f.roleA.id, permissionId: permission.id } },
        update: {},
        create: { roleId: f.roleA.id, permissionId: permission.id },
      });
    }
    for (const key of ['financial.read', 'financial.update']) {
      const permission = await prisma.permission.findUnique({ where: { key } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: f.roleB.id, permissionId: permission.id } },
        update: {},
        create: { roleId: f.roleB.id, permissionId: permission.id },
      });
    }
    token = await loginAs(f.userAdminA, f.password);
  });

  afterAll(async () => {
    for (const id of extra.imports) {
      const row = await prisma.financialImport.findUnique({ where: { id } });
      try {
        if (row && row.storageKey) {
          const file = path.join(__dirname, '..', '..', 'storage', 'financial-imports', row.storageKey);
          if (fs.existsSync(file)) fs.unlinkSync(file);
        }
      } catch { /* best effort */ }
    }
    if (extra.imports.length > 0) await prisma.financialImport.deleteMany({ where: { id: { in: extra.imports } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [f.organizationA.id, f.organizationB.id] } } });
    if (f) await cleanupTenantFixtures(prisma, f);
    await app.close();
  });

  test('A. línea no clasificada acepta clasificación manual', async () => {
    const { statements } = await importProcessed(balancedWithExtra('Rubro misterioso XYZ'));
    const odd = linesOf(statements, 'FINANCIAL_POSITION').find((l) => l.rawLabel === 'Rubro misterioso XYZ');
    expect(odd.classified).toBe(false);
    expect(odd.normalizedKey).toBeNull();
    const res = (await api().patch(`/api/financial-statement-lines/${odd.id}/classification`).set(auth()).send({ normalizedKey: 'financial_position.cash_and_equivalents' }).expect(200)).body;
    expect(res.normalizedKey).toBe('financial_position.cash_and_equivalents');
    expect(res.classified).toBe(true);
    expect(res.classificationSource).toBe('MANUAL');
  });

  test('B. línea automática admite corrección manual', async () => {
    const { statements } = await importProcessed(balancedWithExtra('Rubro misterioso XYZ'));
    const assets = linesOf(statements, 'FINANCIAL_POSITION').find((l) => l.normalizedKey === 'financial_position.total_assets');
    expect(assets.classificationSource).toBe('AUTO');
    const res = (await api().patch(`/api/financial-statement-lines/${assets.id}/classification`).set(auth()).send({ normalizedKey: 'financial_position.current_assets' }).expect(200)).body;
    expect(res.classificationSource).toBe('MANUAL');
    expect(res.normalizedKey).toBe('financial_position.current_assets');
  });

  test('C/D. clave inválida o incompatible devuelve 400', async () => {
    const { statements } = await importProcessed(balancedWithExtra('Rubro misterioso XYZ'));
    const odd = linesOf(statements, 'FINANCIAL_POSITION').find((l) => l.rawLabel === 'Rubro misterioso XYZ');
    await api().patch(`/api/financial-statement-lines/${odd.id}/classification`).set(auth()).send({ normalizedKey: 'inventada.total' }).expect(400);
    await api().patch(`/api/financial-statement-lines/${odd.id}/classification`).set(auth()).send({ normalizedKey: 'cash_flow.operating_activities' }).expect(400);
    await api().patch(`/api/financial-statement-lines/${odd.id}/classification`).set(auth()).send({}).expect(400);
  });

  test('E. tenant cruzado devuelve 404', async () => {
    const { statements } = await importProcessed(balancedWithExtra('Rubro misterioso XYZ'));
    const odd = linesOf(statements, 'FINANCIAL_POSITION').find((l) => l.rawLabel === 'Rubro misterioso XYZ');
    const tokenB = await loginAs(f.userAdminB, f.password);
    await api().patch(`/api/financial-statement-lines/${odd.id}/classification`).set({ Authorization: `Bearer ${tokenB}` }).send({ normalizedKey: 'financial_position.cash_and_equivalents' }).expect(404);
  });

  test('F. sin financial.update devuelve 403', async () => {
    const { statements } = await importProcessed(balancedWithExtra('Rubro misterioso XYZ'));
    const odd = linesOf(statements, 'FINANCIAL_POSITION').find((l) => l.rawLabel === 'Rubro misterioso XYZ');
    const argon2 = require('argon2');
    const role = await prisma.role.create({ data: { organizationId: f.organizationA.id, name: `TEST_FINREAD_${f.suffix}` } });
    const read = await prisma.permission.findUnique({ where: { key: 'financial.read' } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: read.id } });
    const user = await prisma.user.create({
      data: { organizationId: f.organizationA.id, email: `finread-${f.suffix}@example.test`, passwordHash: await argon2.hash('finread-pass'), firstName: 'Fin', lastName: 'Read', roles: { create: { roleId: role.id } } },
    });
    const limited = await loginAs(user, 'finread-pass');
    await api().patch(`/api/financial-statement-lines/${odd.id}/classification`).set({ Authorization: `Bearer ${limited}` }).send({ normalizedKey: 'financial_position.cash_and_equivalents' }).expect(403);
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.role.delete({ where: { id: role.id } });
  });

  test('G. valores y origen no cambian al reclasificar', async () => {
    const { statements } = await importProcessed(balancedWithExtra('Rubro misterioso XYZ'));
    const odd = linesOf(statements, 'FINANCIAL_POSITION').find((l) => l.rawLabel === 'Rubro misterioso XYZ');
    const before = { ...odd };
    await api().patch(`/api/financial-statement-lines/${odd.id}/classification`).set(auth()).send({ normalizedKey: 'financial_position.receivables' }).expect(200);
    const after = (await prisma.financialStatementLine.findUnique({ where: { id: odd.id } }));
    expect(after.currentValue.toString()).toBe(before.currentValue);
    expect(after.previousValue.toString()).toBe(before.previousValue);
    expect(after.difference.toString()).toBe(before.difference);
    expect(after.percentageChange.toString()).toBe(before.percentageChange);
    expect(after.rawLabel).toBe(before.rawLabel);
    expect(after.sourceRow).toBe(before.sourceRow);
    expect(after.sheetName).toBe(before.sheetName);
  });

  test('H. reclasificación queda en AuditLog con anterior y nuevo', async () => {
    const { statements, importId } = await importProcessed(balancedWithExtra('Rubro misterioso XYZ'));
    const odd = linesOf(statements, 'FINANCIAL_POSITION').find((l) => l.rawLabel === 'Rubro misterioso XYZ');
    await api().patch(`/api/financial-statement-lines/${odd.id}/classification`).set(auth()).send({ normalizedKey: 'financial_position.inventories' }).expect(200);
    const log = await prisma.auditLog.findFirst({
      where: { organizationId: f.organizationA.id, action: 'FINANCIAL_LINE_RECLASSIFIED', entityId: odd.id },
    });
    expect(log).toBeTruthy();
    expect(log.actorUserId).toBe(f.userAdminA.id);
    expect(log.before).toMatchObject({ normalizedKey: null });
    expect(log.after).toMatchObject({ normalizedKey: 'financial_position.inventories', classificationSource: 'MANUAL', importId });
  });

  test('I. REVIEW_REQUIRED se recalcula a PROCESSED al clasificar el total', async () => {
    const { status, statements, importId } = await importProcessed(balancedWithExtra('Total ajustes varios'));
    expect(status).toBe('REVIEW_REQUIRED');
    const odd = linesOf(statements, 'FINANCIAL_POSITION').find((l) => l.rawLabel === 'Total ajustes varios');
    const res = (await api().patch(`/api/financial-statement-lines/${odd.id}/classification`).set(auth()).send({ normalizedKey: 'financial_position.cash_and_equivalents' }).expect(200)).body;
    expect(res.importStatus).toBe('PROCESSED');
    const detail = (await api().get(`/api/financial-imports/${importId}`).set(auth()).expect(200)).body;
    expect(detail.status).toBe('PROCESSED');
  });

  test('J. se mantiene REVIEW_REQUIRED si quedan otros issues', async () => {
    const buffer = workbook([['Situación J', [
      ['ESTADO DE SITUACIÓN FINANCIERA'],
      ['Cuenta', '2025', '2024'],
      ['TOTAL DE ACTIVOS', 9999, 4800],
      ['TOTAL DEL PASIVO', 3000, 2900],
      ['TOTAL PATRIMONIO', 2000, 1900],
      ['Rubro misterioso XYZ', 100, 90],
    ]]]);
    const { status, statements } = await importProcessed(buffer);
    expect(status).toBe('REVIEW_REQUIRED');
    const odd = linesOf(statements, 'FINANCIAL_POSITION').find((l) => l.rawLabel === 'Rubro misterioso XYZ');
    const res = (await api().patch(`/api/financial-statement-lines/${odd.id}/classification`).set(auth()).send({ normalizedKey: 'financial_position.cash_and_equivalents' }).expect(200)).body;
    expect(res.importStatus).toBe('REVIEW_REQUIRED');
  });
});
