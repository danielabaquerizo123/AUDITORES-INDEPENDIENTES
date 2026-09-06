const { ContractContextBuilder } = require('../dist/src/contracts/variables/contract-context.builder.js');
const { ContractVariablesValidator } = require('../dist/src/contracts/variables/contract-variables.validator.js');
const { envValidationSchema } = require('../dist/src/config/env.validation.js');

function baseInput(overrides = {}) {
  return {
    contract: {
      contractNumber: 'C-1',
      signingDate: new Date('2025-02-01'),
      effectiveFrom: new Date('2025-01-01'),
      effectiveTo: new Date('2025-12-31'),
      reportDeliveryDate: new Date('2025-03-15'),
      taxReportDeliveryDate: new Date('2025-04-30'),
      informationDeliveryDate: new Date('2025-01-20'),
      draftReportDueDate: new Date('2025-03-01'),
      feeNet: '1500',
      currency: 'USD',
      ...overrides.contract,
    },
    client: { legalName: 'Empresa Ejemplo S.A.', taxId: '1790000000001', address: null, email: null },
    representative: { fullName: 'Representante Test', nationalId: '1700000001', position: 'Gerente' },
    period: { label: 'Auditoría 2025', fiscalYear: 2025, startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31') },
    organization: { name: 'Auditora', legalName: null, taxId: null, auditorName: null, auditorRegistration: null, email: null },
  };
}

describe('fase 4 fechas contractuales (unit)', () => {
  test('A. fechas persistidas llegan al ContextBuilder con naming semántico', () => {
    const { context } = new ContractContextBuilder().build(baseInput());
    expect(context.contract.signingDate).toEqual(new Date('2025-02-01'));
    expect(context.contract.startDate).toEqual(new Date('2025-01-01'));
    expect(context.contract.endDate).toEqual(new Date('2025-12-31'));
    expect(context.audit.periodStart).toEqual(new Date('2025-01-01'));
    expect(context.audit.periodEnd).toEqual(new Date('2025-12-31'));
    expect(context.report.deliveryDate).toEqual(new Date('2025-03-15'));
    expect(context.taxReport.deliveryDate).toEqual(new Date('2025-04-30'));
    expect(context.contract.informationDeliveryDate).toEqual(new Date('2025-01-20'));
    expect(context.contract.draftReportDueDate).toEqual(new Date('2025-03-01'));
    expect(context.contract.finalReportDueDate).toEqual(new Date('2025-03-15'));
  });

  test('B. plantilla con report.deliveryDate sin valor bloquea', () => {
    const { context } = new ContractContextBuilder().build(
      baseInput({ contract: { reportDeliveryDate: null } }),
    );
    const result = new ContractVariablesValidator().validate(context, [
      'Entrega {{report.deliveryDate}}.',
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Fecha contractual sin valor: report.deliveryDate');
  });

  test('C. plantilla sin fechas no bloquea por fechas', () => {
    const { context } = new ContractContextBuilder().build(
      baseInput({ contract: { reportDeliveryDate: null, taxReportDeliveryDate: null } }),
    );
    const result = new ContractVariablesValidator().validate(context, [
      'Contrato {{contract.number}} de {{company.legalName}}.',
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('D. taxReport.deliveryDate se resuelve desde el contrato', () => {
    const { context } = new ContractContextBuilder().build(baseInput());
    const result = new ContractVariablesValidator().validate(context, [
      'Tributario {{taxReport.deliveryDate}}.',
    ]);
    expect(result.valid).toBe(true);
  });

  test('D2. taxReport.deliveryDate sin valor bloquea', () => {
    const { context } = new ContractContextBuilder().build(
      baseInput({ contract: { taxReportDeliveryDate: null } }),
    );
    const result = new ContractVariablesValidator().validate(context, [
      'Tributario {{taxReport.deliveryDate}}.',
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Fecha contractual sin valor: taxReport.deliveryDate');
  });

  test('E. alias legacy taxReportDeliveryDate resuelve sin romper plantillas históricas', () => {
    const { context } = new ContractContextBuilder().build(baseInput());
    const result = new ContractVariablesValidator().validate(context, [
      'Histórica {{taxReportDeliveryDate}}.',
    ]);
    expect(result.valid).toBe(true);
    const empty = new ContractContextBuilder().build(
      baseInput({ contract: { taxReportDeliveryDate: null } }),
    );
    const blocked = new ContractVariablesValidator().validate(empty.context, [
      'Histórica {{taxReportDeliveryDate}}.',
    ]);
    expect(blocked.valid).toBe(false);
  });

  test('O. validación de entorno permite arrancar sin Redis', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost:5432/db',
      FRONTEND_URL: 'http://localhost:5173',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      STORAGE_PATH: '../storage',
    });
    expect(error).toBeUndefined();
  });
});
