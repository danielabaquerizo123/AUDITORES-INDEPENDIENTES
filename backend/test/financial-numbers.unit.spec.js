const { Prisma } = require('@prisma/client');
const { FinancialNumberParser } = require('../dist/src/financial-statements/normalization/financial-number.parser.js');
const { StatementNormalizerService } = require('../dist/src/financial-statements/normalization/statement-normalizer.service.js');
const { ComparativeService } = require('../dist/src/financial-statements/comparatives/comparative.service.js');
const { FinancialValidationService } = require('../dist/src/financial-statements/validations/financial-validation.service.js');

const dec = (text) => new Prisma.Decimal(text);
const numbers = new FinancialNumberParser();
const normalizer = new StatementNormalizerService();
const comparatives = new ComparativeService();
const validations = new FinancialValidationService();

describe('fase 5 numeros y normalizacion (unit)', () => {
  test('normaliza formatos numericos sin inventar valores', () => {
    expect(numbers.parse('1,234.56').value.toString()).toBe('1234.56');
    expect(numbers.parse('1.234,56').value.toString()).toBe('1234.56');
    expect(numbers.parse('(1,234.56)').value.toString()).toBe('-1234.56');
    expect(numbers.parse('-1,234.56').value.toString()).toBe('-1234.56');
    expect(numbers.parse('$ 1.234,56').value.toString()).toBe('1234.56');
    expect(numbers.parse('1 234,56').value.toString()).toBe('1234.56');
    expect(numbers.parse('1.234').value.toString()).toBe('1234');
    expect(numbers.parse('0.5').value.toString()).toBe('0.5');
  });

  test('acepta polvo float de Excel y rechaza enteros gigantes', () => {
    const dusty = numbers.parse('139558.13999999998');
    expect(dusty.kind).toBe('value');
    expect(dusty.value.toString()).toBe('139558.13999999998');
    expect(numbers.parse('1234567890123456').kind).toBe('value');
    expect(numbers.parse('12345678901234567').kind).toBe('invalid');
  });

  test('distingue vacio de cero real', () => {
    expect(numbers.parse(null).kind).toBe('empty');
    expect(numbers.parse('').kind).toBe('empty');
    expect(numbers.parse('   ').kind).toBe('empty');
    const zero = numbers.parse('0');
    expect(zero.kind).toBe('value');
    expect(zero.value.toString()).toBe('0');
    expect(numbers.parse('abc').kind).toBe('invalid');
    expect(numbers.parse(true).kind).toBe('invalid');
  });

  test('normaliza variantes de etiquetas sin depender de un cliente', () => {
    expect(normalizer.normalize('FINANCIAL_POSITION', 'TOTAL DE ACTIVOS')).toBe('financial_position.total_assets');
    expect(normalizer.normalize('FINANCIAL_POSITION', 'Total del activo')).toBe('financial_position.total_assets');
    expect(normalizer.normalize('FINANCIAL_POSITION', 'TOTAL ACTIVOS')).toBe('financial_position.total_assets');
    expect(normalizer.normalize('FINANCIAL_POSITION', 'Total pasivo y patrimonio')).toBe('financial_position.total_liabilities_and_equity');
    expect(normalizer.normalize('COMPREHENSIVE_INCOME', 'Ventas netas')).toBe('comprehensive_income.revenue');
    expect(normalizer.normalize('COMPREHENSIVE_INCOME', 'Costo de ventas')).toBe('comprehensive_income.cost_of_sales');
    expect(normalizer.normalize('COMPREHENSIVE_INCOME', 'Ingresos financieros')).toBe('comprehensive_income.financial_income');
    expect(normalizer.normalize('CASH_FLOW', 'Actividades de operación')).toBe('cash_flow.operating_activities');
    expect(normalizer.normalize('CHANGES_IN_EQUITY', 'Saldo inicial')).toBe('changes_in_equity.opening_balance');
    expect(normalizer.normalize('FINANCIAL_POSITION', 'ACTIVOS TOTALES')).toBe('financial_position.total_assets');
    expect(normalizer.normalize('FINANCIAL_POSITION', 'PASIVOS TOTALES')).toBe('financial_position.total_liabilities');
    expect(normalizer.normalize('FINANCIAL_POSITION', 'PATRIMONIO NETO')).toBe('financial_position.total_equity');
    expect(normalizer.normalize('FINANCIAL_POSITION', 'TOTAL PROPIEDAD PLANTA Y EQUIPO')).toBe('financial_position.property_plant_equipment');
  });

  test('no fuerza clasificacion ante etiquetas desconocidas', () => {
    expect(normalizer.normalize('FINANCIAL_POSITION', 'Rubro misterioso XYZ')).toBeNull();
    expect(normalizer.normalize('FINANCIAL_POSITION', '')).toBeNull();
  });

  test('calcula comparativos deterministicamente', () => {
    const result = comparatives.compare(dec('1200'), dec('1000'));
    expect(result.difference.toString()).toBe('200');
    expect(result.percentageChange.toString()).toBe('20');
    const negative = comparatives.compare(dec('800'), dec('1000'));
    expect(negative.difference.toString()).toBe('-200');
    expect(negative.percentageChange.toString()).toBe('-20');
  });

  test('previous = 0 no divide por cero', () => {
    const result = comparatives.compare(dec('500'), dec('0'));
    expect(result.difference.toString()).toBe('500');
    expect(result.percentageChange).toBeNull();
    const missing = comparatives.compare(dec('500'), null);
    expect(missing.difference).toBeNull();
    expect(missing.percentageChange).toBeNull();
  });

  test('balance correcto no genera discrepancia', () => {
    const line = (key, current, previous) => ({
      sortOrder: 1, rawLabel: key, normalizedKey: key, classified: true,
      sheetName: 'S', sourceRow: 1, sourceCurrentColumn: 2, sourcePreviousColumn: 3,
      currentValue: dec(current), previousValue: dec(previous),
    });
    const issues = validations.validate([{
      type: 'FINANCIAL_POSITION', sheetName: 'S', confidence: 1, currentYear: 2025, previousYear: 2024,
      lines: [
        line('financial_position.total_assets', '5000', '4800'),
        line('financial_position.total_liabilities', '3000', '2900'),
        line('financial_position.total_equity', '2000', '1900'),
      ],
    }]);
    expect(issues.filter((i) => i.code === 'BALANCE_MISMATCH')).toHaveLength(0);
  });

  test('balance descuadrado genera discrepancia sin modificar cifras', () => {
    const line = (key, current) => ({
      sortOrder: 1, rawLabel: key, normalizedKey: key, classified: true,
      sheetName: 'S', sourceRow: 1, sourceCurrentColumn: 2, sourcePreviousColumn: null,
      currentValue: dec(current), previousValue: null,
    });
    const issues = validations.validate([{
      type: 'FINANCIAL_POSITION', sheetName: 'S', confidence: 1, currentYear: 2025, previousYear: null,
      lines: [
        line('financial_position.total_assets', '5100'),
        line('financial_position.total_liabilities', '3000'),
        line('financial_position.total_equity', '2000'),
      ],
    }]);
    const mismatch = issues.find((i) => i.code === 'BALANCE_MISMATCH');
    expect(mismatch).toBeTruthy();
    expect(mismatch.actual).toBe('5100');
    expect(mismatch.expected).toBe('5000');
  });
});
