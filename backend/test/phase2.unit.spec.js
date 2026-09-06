const { AuditPeriodsService } = require('../dist/src/audit-periods/audit-periods.service.js');
const { ContractContextBuilder } = require('../dist/src/contracts/variables/contract-context.builder.js');
const { ContractVariablesValidator } = require('../dist/src/contracts/variables/contract-variables.validator.js');

describe('Fase 2 validation', () => {
  test('rejects an audit period with inverted dates', async () => {
    const service = new AuditPeriodsService({ client: { findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'client' }) }, auditPeriod: { create: jest.fn() } });
    await expect(service.create('organization', 'client', { label: '2026', fiscalYear: 2026, startDate: new Date('2026-12-31'), endDate: new Date('2026-01-01') })).rejects.toThrow('Invalid audit period dates');
  });

  test('builds semantic context and detects missing placeholders', () => {
    const result = new ContractContextBuilder().build({ contract: { signingDate: null, effectiveTo: null, feeNet: null, currency: 'USD' }, client: { legalName: 'Cliente Fixture', taxId: 'FIX-1', address: null, email: null }, representative: null, period: { fiscalYear: 2026, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }, organization: { name: 'Auditora Fixture', legalName: null, taxId: null, auditorName: null, auditorRegistration: null, email: null } });
    expect(result.context.company.legalName).toBe('Cliente Fixture');
    expect(new ContractVariablesValidator().validate(result.context, ['{{company.legalName}} {{representative.name}}'])).toEqual(expect.objectContaining({ valid: false, missing: ['representative.name'] }));
  });
});
