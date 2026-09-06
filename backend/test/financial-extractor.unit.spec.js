const { StatementExtractorService } = require('../dist/src/financial-statements/parsers/statement-extractor.service.js');
const { FinancialNumberParser } = require('../dist/src/financial-statements/normalization/financial-number.parser.js');
const { StatementNormalizerService } = require('../dist/src/financial-statements/normalization/statement-normalizer.service.js');

const extractor = new StatementExtractorService(
  new FinancialNumberParser(),
  new StatementNormalizerService(),
);

describe('fase 5 extractor offsets (unit)', () => {
  test('sourceRow y columnas usan el desplazamiento real del rango', () => {
    const issues = [];
    const result = extractor.extract(
      {
        type: 'FINANCIAL_POSITION',
        sheetName: 'Balance',
        confidence: 1,
        headerRow: 1,
        labelColumn: 0,
        currentColumn: 2,
        previousColumn: 4,
        currentYear: 2026,
        previousYear: 2025,
        ambiguousColumns: false,
      },
      {
        name: 'Balance',
        grid: [
          ['Compañía Ejemplo'],
          ['Cuenta', 'Notas', '2026', '', '2025'],
          ['TOTAL DE ACTIVOS', '4.2', 5000, '', 4800],
        ],
        // Datos que empiezan en C4 de Excel (!ref = C4:...).
        rowOffset: 3,
        colOffset: 2,
      },
      issues,
    );
    expect(issues).toHaveLength(0);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0].sourceRow).toBe(6);
    expect(result.lines[0].sourceCurrentColumn).toBe(5);
    expect(result.lines[0].sourcePreviousColumn).toBe(7);
  });
});
