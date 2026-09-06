import { Injectable } from '@nestjs/common';
import { FinancialNumberParser } from '../normalization/financial-number.parser';
import { StatementNormalizerService } from '../normalization/statement-normalizer.service';
import type { ValidationIssue, ProcessedStatement } from '../validations/financial-validation.service';
import type { DetectedStatement } from './statement-detection.service';
import type { ParsedSheet } from './excel-parser.service';

function labelText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return '';
  if (typeof value === 'number') return '';
  return String(value).trim();
}

/** Texto sin ningún dígito (firmas, notas al pie): no es un número fallido. */
function isNonNumericText(value: unknown): boolean {
  return typeof value === 'string' && !/\d/.test(value);
}

/**
 * Extrae líneas de una hoja ya detectada. Tolera filas vacías y títulos
 * intermedios (se omiten, no se persisten). Las filas con números imposibles
 * de interpretar generan issue y se omiten sin "arreglar" cifras.
 */
@Injectable()
export class StatementExtractorService {
  constructor(
    private readonly numbers: FinancialNumberParser,
    private readonly normalizer: StatementNormalizerService,
  ) {}

  extract(
    detected: DetectedStatement,
    sheet: ParsedSheet,
    issues: ValidationIssue[],
  ): ProcessedStatement {
    const lines: ProcessedStatement['lines'] = [];
    let order = 0;
    for (let r = detected.headerRow + 1; r < sheet.grid.length; r += 1) {
      const row = sheet.grid[r] ?? [];
      const rawLabel = labelText(row[detected.labelColumn]);
      if (rawLabel === '') continue;

      const currentRaw = row[detected.currentColumn] ?? null;
      const previousRaw =
        detected.previousColumn === null ? null : (row[detected.previousColumn] ?? null);
      // Firmas y textos al pie en columnas de años: no son datos ni errores.
      const currentParsed = isNonNumericText(currentRaw)
        ? { kind: 'empty' as const }
        : this.numbers.parse(currentRaw);
      const previousParsed =
        previousRaw === null || isNonNumericText(previousRaw)
          ? { kind: 'empty' as const }
          : this.numbers.parse(previousRaw);

      if (currentParsed.kind === 'invalid' || previousParsed.kind === 'invalid') {
        issues.push({
          code: 'UNPARSEABLE_NUMBER',
          message: `Números imposibles de interpretar en "${rawLabel}"`,
          statementType: detected.type,
          sheetName: detected.sheetName,
          sourceRow: r + 1 + sheet.rowOffset,
        });
        continue;
      }
      if (currentParsed.kind === 'empty' && previousParsed.kind === 'empty') continue;

      const normalizedKey = this.normalizer.normalize(detected.type, rawLabel);
      order += 1;
      lines.push({
        sortOrder: order,
        rawLabel,
        normalizedKey,
        classified: normalizedKey !== null,
        sheetName: detected.sheetName,
        sourceRow: r + 1 + sheet.rowOffset,
        sourceCurrentColumn: detected.currentColumn + 1 + sheet.colOffset,
        sourcePreviousColumn: detected.previousColumn === null ? null : detected.previousColumn + 1 + sheet.colOffset,
        currentValue: currentParsed.kind === 'value' ? currentParsed.value ?? null : null,
        previousValue: previousParsed.kind === 'value' ? (previousParsed.value ?? null) : null,
      });
    }
    return {
      type: detected.type,
      sheetName: detected.sheetName,
      confidence: detected.confidence,
      currentYear: detected.currentYear,
      previousYear: detected.previousYear,
      lines,
    };
  }
}
