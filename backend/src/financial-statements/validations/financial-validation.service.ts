import { Injectable } from '@nestjs/common';
import { Prisma, FinancialStatementType } from '@prisma/client';

export interface ProcessedLine {
  sortOrder: number;
  rawLabel: string;
  normalizedKey: string | null;
  classified: boolean;
  sheetName: string;
  sourceRow: number;
  sourceCurrentColumn: number | null;
  sourcePreviousColumn: number | null;
  currentValue: Prisma.Decimal | null;
  previousValue: Prisma.Decimal | null;
}

export interface ProcessedStatement {
  type: FinancialStatementType;
  sheetName: string;
  confidence: number;
  currentYear: number | null;
  previousYear: number | null;
  lines: ProcessedLine[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  statementType?: FinancialStatementType;
  sheetName?: string;
  sourceRow?: number;
  expected?: string;
  actual?: string;
}

/**
 * Tolerancia contable para la ecuación ACTIVO ≈ PASIVO + PATRIMONIO.
 * Cubre redondeos de origen; nunca se modifican cifras, solo se reporta.
 */
export const BALANCE_TOLERANCE = new Prisma.Decimal('1.00');

// Códigos que obligan REVIEW_REQUIRED al recalcular (tras reproceso o
// reclasificación manual). El resto de issues solo se informa.
export const REVIEW_CODES = new Set([
  'AMBIGUOUS_COLUMNS',
  'YEARS_MISSING',
  'PREVIOUS_YEAR_MISSING',
  'INCOMPLETE_STATEMENT',
  'UNPARSEABLE_NUMBER',
  'UNCLASSIFIED_TOTAL_LINE',
  'BALANCE_MISMATCH',
]);

export function decideImportStatus(
  statements: ProcessedStatement[],
  issues: ValidationIssue[],
): 'PROCESSED' | 'REVIEW_REQUIRED' | 'FAILED' {
  // Sin ningún estado detectado no hay nada que revisar: FAILED.
  // Un estado detectado pero sin líneas genera INCOMPLETE_STATEMENT
  // y cae en REVIEW_REQUIRED con el motivo explícito.
  if (statements.length === 0) return 'FAILED';
  if (issues.some((issue) => REVIEW_CODES.has(issue.code))) return 'REVIEW_REQUIRED';
  return 'PROCESSED';
}

function byKey(lines: ProcessedLine[], key: string): ProcessedLine | undefined {
  return lines.find((line) => line.normalizedKey === key);
}

@Injectable()
export class FinancialValidationService {
  validate(statements: ProcessedStatement[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    if (statements.length === 0) {
      issues.push({ code: 'NO_STATEMENT_DETECTED', message: 'No se detectó ningún estado financiero en el archivo' });
      return issues;
    }
    for (const statement of statements) {
      if (statement.currentYear === null) {
        issues.push({
          code: 'YEARS_MISSING',
          message: `No se detectó el año actual en la hoja "${statement.sheetName}"`,
          statementType: statement.type,
          sheetName: statement.sheetName,
        });
      }
      if (statement.currentYear !== null && statement.previousYear === null) {
        issues.push({
          code: 'PREVIOUS_YEAR_MISSING',
          message: `No se detectó año anterior en la hoja "${statement.sheetName}"; los comparativos quedarán en null`,
          statementType: statement.type,
          sheetName: statement.sheetName,
        });
      }
      if (statement.lines.length === 0) {
        issues.push({
          code: 'INCOMPLETE_STATEMENT',
          message: `Estado ${statement.type} sin líneas extraídas en la hoja "${statement.sheetName}"`,
          statementType: statement.type,
          sheetName: statement.sheetName,
        });
      }
      for (const line of statement.lines) {
        if (!line.classified && /total|subtotal/i.test(line.rawLabel)) {
          issues.push({
            code: 'UNCLASSIFIED_TOTAL_LINE',
            message: `Línea de total sin clasificar: "${line.rawLabel}"`,
            statementType: statement.type,
            sheetName: statement.sheetName,
            sourceRow: line.sourceRow,
          });
        }
      }
    }
    issues.push(...this.checkBalance(statements));
    return issues;
  }

  private checkBalance(statements: ProcessedStatement[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const position = statements.find((s) => s.type === 'FINANCIAL_POSITION');
    if (!position) return issues;
    const assets = byKey(position.lines, 'financial_position.total_assets');
    const liabilities = byKey(position.lines, 'financial_position.total_liabilities');
    const equity = byKey(position.lines, 'financial_position.total_equity');
    if (!assets || !liabilities || !equity) return issues;
    for (const year of ['currentValue', 'previousValue'] as const) {
      const left = year === 'currentValue' ? assets.currentValue : assets.previousValue;
      const liab = year === 'currentValue' ? liabilities.currentValue : liabilities.previousValue;
      const eq = year === 'currentValue' ? equity.currentValue : equity.previousValue;
      if (left === null || liab === null || eq === null) continue;
      const expected = liab.plus(eq);
      const diff = left.minus(expected).abs();
      if (diff.greaterThan(BALANCE_TOLERANCE)) {
        issues.push({
          code: 'BALANCE_MISMATCH',
          message: `ACTIVO ≠ PASIVO + PATRIMONIO (${year === 'currentValue' ? 'año actual' : 'año anterior'}): diferencia ${diff.toString()}`,
          statementType: 'FINANCIAL_POSITION',
          sheetName: position.sheetName,
          expected: expected.toString(),
          actual: left.toString(),
        });
      }
    }
    return issues;
  }
}
