const { AmountToWordsService } = require('../dist/src/contracts/variables/amount-to-words.service.js');
const { ContractContextBuilder } = require('../dist/src/contracts/variables/contract-context.builder.js');
const { ContractVariablesValidator } = require('../dist/src/contracts/variables/contract-variables.validator.js');
const { ContractTemplateRenderer } = require('../dist/src/contracts/variables/contract-template.renderer.js');

describe('contract engine units', () => {
  test('converts fees to Spanish words deterministically', () => {
    const words = new AmountToWordsService();
    expect(words.convert(1500, 'USD')).toBe('Mil quinientos dólares americanos con 00/100');
    expect(words.convert('1500.50', 'USD')).toBe('Mil quinientos dólares americanos con 50/100');
    expect(words.convert(0, 'USD')).toBe('Cero dólares americanos con 00/100');
    expect(words.convert(1, 'USD')).toBe('Uno dólar americano con 00/100');
    expect(words.convert(21, 'USD')).toBe('Veintiuno dólares americanos con 00/100');
    expect(words.convert(100, 'USD')).toBe('Cien dólares americanos con 00/100');
    expect(words.convert(101, 'USD')).toBe('Ciento uno dólares americanos con 00/100');
    expect(words.convert(1000000, 'USD')).toBe('Un millón dólares americanos con 00/100');
    expect(words.convert(2000001, 'USD')).toBe('Dos millones uno dólares americanos con 00/100');
    expect(words.convert(1500, 'EUR')).toBe('Mil quinientos EUR con 00/100');
    expect(() => words.convert(-5, 'USD')).toThrow('Amount out of range');
    expect(() => words.convert(1000000000, 'USD')).toThrow('Amount out of range');
  });

  test('builds feeWords and organization paths from real data', () => {
    const result = new ContractContextBuilder().build({
      contract: { contractNumber: 'C-1', signingDate: new Date('2025-02-01'), effectiveFrom: new Date('2025-01-01'), effectiveTo: new Date('2025-12-31'), feeNet: '1500', currency: 'USD' },
      client: { legalName: 'Empresa Ejemplo S.A.', taxId: '1790000000001', address: null, email: null },
      representative: { fullName: 'Representante Test', nationalId: '1700000001', position: 'Gerente' },
      period: { label: 'Auditoría 2025', fiscalYear: 2025, startDate: new Date('2025-01-01'), endDate: new Date('2025-12-31') },
      organization: { name: 'Auditora', legalName: null, taxId: null, auditorName: null, auditorRegistration: null, email: null },
    });
    expect(result.context.contract.feeWords).toBe('Mil quinientos dólares americanos con 00/100');
    expect(result.context.contract.number).toBe('C-1');
    expect(result.context.organization.name).toBe('Auditora');
    expect(result.context.audit.label).toBe('Auditoría 2025');
  });

  test('blocks missing report dates and unknown variables', () => {
    const validator = new ContractVariablesValidator();
    const context = { company: { legalName: 'X' }, representative: { name: undefined }, report: { deliveryDate: undefined } };
    const result = validator.validate(context, ['{{company.legalName}}', '{{foo.bar}}', '{{representative.name}}', '{{report.deliveryDate}}']);
    expect(result.valid).toBe(false);
    expect(result.unknown).toEqual(['foo.bar']);
    expect(result.errors).toContain('Variable desconocida: foo.bar');
    expect(result.errors).toContain('El cliente no tiene un representante principal configurado.');
    expect(result.errors).toContain('Fecha contractual sin valor: report.deliveryDate');
    expect(result.warnings).toEqual([]);
  });

  test('renders clauses with the same context used by preview and documents', () => {
    const renderer = new ContractTemplateRenderer();
    const sections = renderer.renderClauses(
      [{ clauseKey: 'b', title: 'B', body: '{{company.legalName}}', sortOrder: 2 }, { clauseKey: 'a', title: 'A', body: 'Año {{audit.year}} desde {{audit.periodStart}}', sortOrder: 1 }],
      { company: { legalName: 'Empresa Ejemplo S.A.' }, audit: { year: 2025, periodStart: new Date('2025-01-01') } },
    );
    expect(sections.map((section) => section.clauseKey)).toEqual(['a', 'b']);
    expect(sections[0].body).toBe('Año 2025 desde 2025-01-01');
    expect(sections[1].body).toBe('Empresa Ejemplo S.A.');
  });
});
