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

// Fixture A: hojas separadas, balance cuadrado.
function fixtureA() {
  return workbook([
    ['Situación Financiera', [
      ['ESTADO DE SITUACIÓN FINANCIERA'],
      ['Al 31 de diciembre del 2025'],
      [],
      ['Cuenta', '2025', '2024'],
      ['Efectivo y equivalentes', 1000, 900],
      ['TOTAL DE ACTIVOS', 5000, 4800],
      ['TOTAL DEL PASIVO', 3000, 2900],
      ['TOTAL PATRIMONIO', 2000, 1900],
      [],
      ['Nota intermedia sin números'],
    ]],
    ['Resultados Integrales', [
      ['ESTADO DE RESULTADOS INTEGRAL'],
      ['Detalle', '2025', '2024'],
      ['Ventas netas', 10000, 9000],
      ['Utilidad neta del ejercicio', 1500, 1200],
    ]],
    ['Patrimonio', [
      ['ESTADO DE CAMBIOS EN EL PATRIMONIO'],
      ['Concepto', '2025', '2024'],
      ['Saldo inicial', 1900, 1800],
      ['Saldo final', 2000, 1900],
    ]],
    ['Flujo Efectivo', [
      ['ESTADO DE FLUJOS DE EFECTIVO'],
      ['Rubro', '2025', '2024'],
      ['Actividades de operación', 800, 700],
      ['Efectivo al final', 1000, 900],
    ]],
  ]);
}

describe('fase 5 importacion financiera', () => {
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

  function upload(periodId, buffer, filename = 'estados.xlsx', headers = null) {
    return api()
      .post(`/api/audit-periods/${periodId}/financial-imports`)
      .set(headers ?? auth())
      .attach('file', buffer, filename);
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
    for (const key of ['financial.read', 'financial.import']) {
      const permission = await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
      for (const roleId of [f.roleA.id, f.roleB.id]) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId: permission.id } },
          update: {},
          create: { roleId, permissionId: permission.id },
        });
      }
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

  test('upload válido persiste original inmutable con metadatos', async () => {
    const res = await upload(f.periodA.id, fixtureA()).expect(201);
    extra.imports.push(res.body.id);
    expect(res.body.status).toBe('UPLOADED');
    expect(res.body.originalFileName).toBe('estados.xlsx');
    expect(res.body.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(res.body.sizeBytes).toBeGreaterThan(0);
    expect(res.body).not.toHaveProperty('storageKey');
    expect(res.body.uploadedById).toBe(f.userAdminA.id);
    const row = await prisma.financialImport.findUnique({ where: { id: res.body.id } });
    expect(row.storageKey).toMatch(/^fin-.*\.xlsx$/);
    const stored = path.join(__dirname, '..', '..', 'storage', 'financial-imports', row.storageKey);
    expect(fs.existsSync(stored)).toBe(true);
  });

  test('rechaza extensión inválida, corrupto y vacío', async () => {
    await upload(f.periodA.id, Buffer.from('no es excel'), 'estados.txt').expect(400);
    await upload(f.periodA.id, Buffer.from('contenido falso con firma ausente'), 'falso.xlsx').expect(400);
    await upload(f.periodA.id, Buffer.alloc(0), 'vacio.xlsx').expect(400);
  });

  test('tenant cruzado devuelve 404 y 403 sin permiso', async () => {
    const tokenB = await loginAs(f.userAdminB, f.password);
    const authB = { Authorization: `Bearer ${tokenB}` };
    await upload(f.periodA.id, fixtureA(), 'estados.xlsx', authB).expect(404);
    const own = await upload(f.periodA.id, fixtureA()).expect(201);
    extra.imports.push(own.body.id);
    await api().get(`/api/financial-imports/${own.body.id}`).set(authB).expect(404);
    await api().post(`/api/financial-imports/${own.body.id}/process`).set(authB).expect(404);

    const argon2 = require('argon2');
    const role = await prisma.role.create({ data: { organizationId: f.organizationA.id, name: `TEST_NOFIN_${f.suffix}` } });
    const user = await prisma.user.create({
      data: { organizationId: f.organizationA.id, email: `nofin-${f.suffix}@example.test`, passwordHash: await argon2.hash('nofin-pass'), firstName: 'No', lastName: 'Fin', roles: { create: { roleId: role.id } } },
    });
    const limited = await loginAs(user, 'nofin-pass');
    const limitedAuth = { Authorization: `Bearer ${limited}` };
    await upload(f.periodA.id, fixtureA(), 'estados.xlsx', limitedAuth).expect(403);
    await api().get(`/api/audit-periods/${f.periodA.id}/financial-imports`).set(limitedAuth).expect(403);
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.role.delete({ where: { id: role.id } });
  });

  test('procesa 4 estados con años, líneas y comparativos', async () => {
    const created = await upload(f.periodA.id, fixtureA()).expect(201);
    extra.imports.push(created.body.id);
    const processed = (await api().post(`/api/financial-imports/${created.body.id}/process`).set(auth()).expect(201)).body;
    expect(processed.status).toBe('PROCESSED');
    expect(processed.statements).toHaveLength(4);

    const statements = (await api().get(`/api/financial-imports/${created.body.id}/statements`).set(auth()).expect(200)).body;
    const byType = Object.fromEntries(statements.map((s) => [s.type, s]));
    expect(byType.FINANCIAL_POSITION.currentYear).toBe(2025);
    expect(byType.FINANCIAL_POSITION.previousYear).toBe(2024);
    const assets = byType.FINANCIAL_POSITION.lines.find((l) => l.normalizedKey === 'financial_position.total_assets');
    expect(assets.rawLabel).toBe('TOTAL DE ACTIVOS');
    expect(assets.classified).toBe(true);
    expect(assets.currentValue).toBe('5000');
    expect(assets.previousValue).toBe('4800');
    expect(assets.difference).toBe('200');
    expect(assets.sourceRow).toBeGreaterThan(0);
    expect(assets.sheetName).toBe('Situación Financiera');
    const profit = byType.COMPREHENSIVE_INCOME.lines.find((l) => l.normalizedKey === 'comprehensive_income.net_profit');
    expect(profit.difference).toBe('300');
    expect(profit.percentageChange).toBe('25');
    // Títulos intermedios y filas vacías no se persisten como líneas.
    expect(byType.FINANCIAL_POSITION.lines.map((l) => l.rawLabel)).not.toContain('Nota intermedia sin números');
  });

  test('C. columnas invertidas se mapean por año, no por posición', async () => {
    const buffer = workbook([['Balance Invertido', [
      ['ESTADO DE SITUACIÓN FINANCIERA'],
      ['Cuenta', '2024', '2025'],
      ['TOTAL DE ACTIVOS', 4800, 5000],
      ['TOTAL DEL PASIVO', 2900, 3000],
      ['TOTAL PATRIMONIO', 1900, 2000],
    ]]]);
    const created = await upload(f.periodA.id, buffer).expect(201);
    extra.imports.push(created.body.id);
    await api().post(`/api/financial-imports/${created.body.id}/process`).set(auth()).expect(201);
    const statements = (await api().get(`/api/financial-imports/${created.body.id}/statements`).set(auth()).expect(200)).body;
    const assets = statements[0].lines.find((l) => l.normalizedKey === 'financial_position.total_assets');
    expect(assets.currentValue).toBe('5000');
    expect(assets.previousValue).toBe('4800');
  });

  test('D. formatos numéricos distintos se normalizan', async () => {
    const wb = XLSX.utils.book_new();
    wb.SheetNames.push('Resultados Formatos');
    wb.Sheets['Resultados Formatos'] = XLSX.utils.aoa_to_sheet([
      ['ESTADO DE RESULTADOS INTEGRAL'],
      ['Detalle', '2025', '2024'],
      ['Ventas netas', '10.000,50', '9,000.25'],
      ['Costo de ventas', '(4.000)', '$ 3.500'],
      ['Ingresos financieros', '1.234,56', '1,234.56'],
      ['Utilidad neta del ejercicio', '6.000,50', '5.500'],
    ]);
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const created = await upload(f.periodA.id, buffer).expect(201);
    extra.imports.push(created.body.id);
    const processed = (await api().post(`/api/financial-imports/${created.body.id}/process`).set(auth()).expect(201)).body;
    expect(processed.status).toBe('PROCESSED');
    const statements = (await api().get(`/api/financial-imports/${created.body.id}/statements`).set(auth()).expect(200)).body;
    const byKey = Object.fromEntries(statements[0].lines.map((l) => [l.normalizedKey, l]));
    expect(byKey['comprehensive_income.revenue'].currentValue).toBe('10000.5');
    expect(byKey['comprehensive_income.revenue'].previousValue).toBe('9000.25');
    expect(byKey['comprehensive_income.cost_of_sales'].currentValue).toBe('-4000');
    expect(byKey['comprehensive_income.cost_of_sales'].previousValue).toBe('3500');
    expect(byKey['comprehensive_income.financial_income'].currentValue).toBe('1234.56');
    expect(byKey['comprehensive_income.financial_income'].previousValue).toBe('1234.56');
    expect(byKey['comprehensive_income.net_profit'].currentValue).toBe('6000.5');
  });

  test('E. previous = 0 deja porcentaje en null', async () => {
    const buffer = workbook([['Resultados Nuevos', [
      ['ESTADO DE RESULTADOS'],
      ['Detalle', '2025', '2024'],
      ['Ventas netas', 1000, 0],
      ['Utilidad neta del ejercicio', 100, 0],
    ]]]);
    const created = await upload(f.periodA.id, buffer).expect(201);
    extra.imports.push(created.body.id);
    await api().post(`/api/financial-imports/${created.body.id}/process`).set(auth()).expect(201);
    const statements = (await api().get(`/api/financial-imports/${created.body.id}/statements`).set(auth()).expect(200)).body;
    const revenue = statements[0].lines.find((l) => l.normalizedKey === 'comprehensive_income.revenue');
    expect(revenue.difference).toBe('1000');
    expect(revenue.percentageChange).toBeNull();
  });

  test('F. línea desconocida queda no clasificada sin bloquear', async () => {
    const buffer = workbook([['Situación F', [
      ['ESTADO DE SITUACIÓN FINANCIERA'],
      ['Cuenta', '2025', '2024'],
      ['Rubro misterioso XYZ', 100, 90],
      ['TOTAL DE ACTIVOS', 5100, 4990],
      ['TOTAL DEL PASIVO', 3000, 2900],
      ['TOTAL PATRIMONIO', 2100, 2090],
    ]]]);
    const created = await upload(f.periodA.id, buffer).expect(201);
    extra.imports.push(created.body.id);
    const processed = (await api().post(`/api/financial-imports/${created.body.id}/process`).set(auth()).expect(201)).body;
    expect(processed.status).toBe('PROCESSED');
    const statements = (await api().get(`/api/financial-imports/${created.body.id}/statements`).set(auth()).expect(200)).body;
    const odd = statements[0].lines.find((l) => l.rawLabel === 'Rubro misterioso XYZ');
    expect(odd.classified).toBe(false);
    expect(odd.normalizedKey).toBeNull();
  });

  test('G. balance descuadrado exige revisión con discrepancia', async () => {
    const buffer = workbook([['Situación G', [
      ['ESTADO DE SITUACIÓN FINANCIERA'],
      ['Cuenta', '2025', '2024'],
      ['TOTAL DE ACTIVOS', 9999, 4800],
      ['TOTAL DEL PASIVO', 3000, 2900],
      ['TOTAL PATRIMONIO', 2000, 1900],
    ]]]);
    const created = await upload(f.periodA.id, buffer).expect(201);
    extra.imports.push(created.body.id);
    const processed = (await api().post(`/api/financial-imports/${created.body.id}/process`).set(auth()).expect(201)).body;
    expect(processed.status).toBe('REVIEW_REQUIRED');
    expect(processed.issues.map((i) => i.code)).toContain('BALANCE_MISMATCH');
    const detail = (await api().get(`/api/financial-imports/${created.body.id}`).set(auth()).expect(200)).body;
    expect(detail.status).toBe('REVIEW_REQUIRED');
    expect(JSON.stringify(detail.validationIssues)).toContain('BALANCE_MISMATCH');
  });

  test('archivo sin estados detectables falla con error claro', async () => {
    const buffer = workbook([['Datos', [['hola', 'mundo'], ['foo', 'bar']]]]);
    const created = await upload(f.periodA.id, buffer).expect(201);
    extra.imports.push(created.body.id);
    const processed = (await api().post(`/api/financial-imports/${created.body.id}/process`).set(auth()).expect(201)).body;
    expect(processed.status).toBe('FAILED');
    expect(processed.issues.map((i) => i.code)).toContain('NO_STATEMENT_DETECTED');
  });

  test('reproceso versiona sin duplicar y registra auditoría', async () => {    const created = await upload(f.periodA.id, fixtureA()).expect(201);
    extra.imports.push(created.body.id);
    await api().post(`/api/financial-imports/${created.body.id}/process`).set(auth()).expect(201);
    const first = (await api().get(`/api/financial-imports/${created.body.id}`).set(auth()).expect(200)).body;
    await api().post(`/api/financial-imports/${created.body.id}/process`).set(auth()).expect(201);
    const second = (await api().get(`/api/financial-imports/${created.body.id}`).set(auth()).expect(200)).body;
    expect(second.version).toBe(first.version + 1);
    expect(second.attemptCount).toBe(first.attemptCount + 1);
    const count = await prisma.financialStatement.count({ where: { importId: created.body.id } });
    expect(count).toBe(4);
    const logs = await prisma.auditLog.findMany({
      where: { organizationId: f.organizationA.id, entityType: 'FinancialImport', entityId: created.body.id },
    });
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining([
      'FINANCIAL_IMPORT_UPLOADED',
      'FINANCIAL_IMPORT_PROCESSING_STARTED',
      'FINANCIAL_IMPORT_PROCESSING_FINISHED',
    ]));
    expect(JSON.stringify(logs)).not.toContain('TOTAL DE ACTIVOS');
  });

  test('R1. columna de notas y datos fuera de A1 usan trazabilidad real', async () => {
    const ws = XLSX.utils.aoa_to_sheet([[]]);
    XLSX.utils.sheet_add_aoa(
      ws,
      [
        ['BALANCE GENERAL SINTÉTICO'],
        ['Rubro', 'Nota', '2026', '', '2025'],
        ['TOTAL DE ACTIVOS', 7, 8000, '', 7500],
        ['TOTAL DEL PASIVO', 8, 5000, '', 4700],
        ['TOTAL PATRIMONIO', 9, 3000, '', 2800],
      ],
      { origin: 'B3' },
    );
    const wb = XLSX.utils.book_new();
    wb.SheetNames.push('Balance Notas');
    wb.Sheets['Balance Notas'] = ws;
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const created = await upload(f.periodA.id, buffer, 'notas.xlsx').expect(201);
    extra.imports.push(created.body.id);
    const processed = (await api().post(`/api/financial-imports/${created.body.id}/process`).set(auth()).expect(201)).body;
    expect(processed.status).toBe('PROCESSED');
    const statements = (await api().get(`/api/financial-imports/${created.body.id}/statements`).set(auth()).expect(200)).body;
    const assets = statements[0].lines.find((l) => l.normalizedKey === 'financial_position.total_assets');
    expect(assets.currentValue).toBe('8000');
    expect(assets.previousValue).toBe('7500');
    // Datos en B3: primera línea en Excel r5, valores en D/F.
    expect(assets.sourceRow).toBe(5);
    expect(assets.sourceCurrentColumn).toBe(4);
    expect(assets.sourcePreviousColumn).toBe(6);
  });

  test('R2. layout matriz con años en filas no genera líneas basura', async () => {    const buffer = workbook([['Patrimonio Matriz', [
      ['ESTADO DE CAMBIOS EN EL PATRIMONIO SINTÉTICO'],
      ['Componente', 'Capital', 'Reservas'],
      ['Saldo al 1 de enero de 2025', 1000, 500],
      ['Saldo al 31 de diciembre de 2025', 1100, 550],
    ]]]);
    const created = await upload(f.periodA.id, buffer, 'matriz.xlsx').expect(201);
    extra.imports.push(created.body.id);
    const processed = (await api().post(`/api/financial-imports/${created.body.id}/process`).set(auth()).expect(201)).body;
    expect(processed.status).toBe('REVIEW_REQUIRED');
    expect(processed.issues.map((i) => i.code)).toContain('AMBIGUOUS_COLUMNS');
    const statements = (await api().get(`/api/financial-imports/${created.body.id}/statements`).set(auth()).expect(200)).body;
    const equity = statements.find((s) => s.type === 'CHANGES_IN_EQUITY');
    expect(equity).toBeTruthy();
    expect(equity.lines).toHaveLength(0);
  });

  test('R3. totales invertidos se normalizan y firmas se omiten sin ruido', async () => {
    const buffer = workbook([['Balance Invertido', [
      ['BALANCE SINTÉTICO'],
      ['Rubro', '2026', '2025'],
      ['ACTIVOS TOTALES', 8000, 7500],
      ['PASIVOS TOTALES', 5000, 4700],
      ['PATRIMONIO NETO', 3000, 2800],
      ['Elaborado por Gerencia', '', ''],
      ['CONTADOR GENERAL', '', ''],
    ]]]);
    const created = await upload(f.periodA.id, buffer, 'invertidos.xlsx').expect(201);
    extra.imports.push(created.body.id);
    const processed = (await api().post(`/api/financial-imports/${created.body.id}/process`).set(auth()).expect(201)).body;
    expect(processed.status).toBe('PROCESSED');
    expect(processed.issues).toHaveLength(0);
    const statements = (await api().get(`/api/financial-imports/${created.body.id}/statements`).set(auth()).expect(200)).body;
    const byKey = Object.fromEntries(statements[0].lines.map((l) => [l.normalizedKey, l]));
    expect(byKey['financial_position.total_assets'].currentValue).toBe('8000');
    expect(byKey['financial_position.total_liabilities'].currentValue).toBe('5000');
    expect(byKey['financial_position.total_equity'].currentValue).toBe('3000');
    expect(statements[0].lines.map((l) => l.rawLabel)).not.toContain('Elaborado por Gerencia');
  });
});
