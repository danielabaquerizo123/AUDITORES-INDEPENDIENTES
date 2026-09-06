import { Injectable } from '@nestjs/common';
import { FinancialStatementType } from '@prisma/client';
import { plainText, isLabelText } from '../normalization/text.utils';
import type { ParsedSheet } from './excel-parser.service';

export interface DetectedStatement {
  type: FinancialStatementType;
  sheetName: string;
  confidence: number;
  headerRow: number;
  labelColumn: number;
  currentColumn: number;
  previousColumn: number | null;
  currentYear: number | null;
  previousYear: number | null;
  ambiguousColumns: boolean;
}

interface Keyword {
  pattern: RegExp;
  weight: number;
}

// Detección determinista por scoring. Pesos genéricos del dominio contable;
// ningún término referencia clientes, hojas, filas o años concretos.
const KEYWORDS: Record<FinancialStatementType, Keyword[]> = {
  FINANCIAL_POSITION: [
    { pattern: /\bactivo\b/, weight: 2 },
    { pattern: /\bpasivo\b/, weight: 2 },
    { pattern: /\bpatrimonio\b/, weight: 2 },
    { pattern: /situacion\s+financiera/, weight: 4 },
    { pattern: /\bbalance\b/, weight: 3 },
    { pattern: /estado\s+de\s+situacion/, weight: 4 },
  ],
  COMPREHENSIVE_INCOME: [
    { pattern: /\bingresos?\b/, weight: 2 },
    { pattern: /\bgastos?\b/, weight: 1 },
    { pattern: /\bcostos?\b/, weight: 1 },
    { pattern: /utilidad/, weight: 2 },
    { pattern: /perdida/, weight: 2 },
    { pattern: /resultado(\s+integral)?/, weight: 3 },
    { pattern: /estado\s+de\s+resultados?/, weight: 4 },
  ],
  CHANGES_IN_EQUITY: [
    { pattern: /cambios?\s+en\s+(el\s+)?patrimonio/, weight: 5 },
    { pattern: /movimientos?\s+(del\s+)?patrimonio/, weight: 4 },
    { pattern: /evolucion\s+del\s+patrimonio/, weight: 4 },
    { pattern: /\bpatrimonio\b/, weight: 1 },
  ],
  CASH_FLOW: [
    { pattern: /flujo\s+de\s+efectivo/, weight: 5 },
    { pattern: /actividades?\s+de\s+operacion/, weight: 3 },
    { pattern: /actividades?\s+de\s+inversion/, weight: 3 },
    { pattern: /actividades?\s+de\s+financia/, weight: 3 },
    { pattern: /\befectivo\b/, weight: 1 },
  ],
};

const SCORE_THRESHOLD = 4;
const MAX_HEADER_SCAN_ROWS = 15;
const MAX_TEXT_SCAN_ROWS = 30;
const MAX_TEXT_SCAN_COLS = 20;

const YEAR_CELL = /\b(19\d{2}|20\d{2})\b/;
const SPANISH_DATE_YEAR =
  /(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\s+(de\s+|del\s+)?(19\d{2}|20\d{2})/;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return '';
  return plainText(value);
}

function plausibleYear(year: number): boolean {
  return year >= 1990 && year <= 2100;
}

@Injectable()
export class StatementDetectionService {
  detect(sheets: ParsedSheet[]): DetectedStatement[] {
    const assigned = new Map<FinancialStatementType, DetectedStatement>();
    for (const sheet of sheets) {
      const found = this.detectSheet(sheet);
      if (!found) continue;
      const current = assigned.get(found.type);
      if (!current || found.confidence > current.confidence) assigned.set(found.type, found);
    }
    return [...assigned.values()];
  }

  private detectSheet(sheet: ParsedSheet): DetectedStatement | null {
    const nameText = cellText(sheet.name);
    const zone = this.zoneText(sheet);
    let best: { type: FinancialStatementType; score: number } | null = null;
    for (const type of Object.keys(KEYWORDS) as FinancialStatementType[]) {
      let score = 0;
      for (const keyword of KEYWORDS[type]) {
        if (keyword.pattern.test(nameText)) score += keyword.weight * 3;
        if (keyword.pattern.test(zone)) score += keyword.weight;
      }
      if (!best || score > best.score) best = { type, score };
    }
    if (!best || best.score < SCORE_THRESHOLD) return null;

    const years = this.detectYears(sheet);
    const columns = this.detectColumns(sheet, years);
    return {
      type: best.type,
      sheetName: sheet.name,
      confidence: Math.min(1, Math.max(0.3, best.score / 12)),
      headerRow: columns.headerRow,
      labelColumn: columns.labelColumn,
      currentColumn: columns.currentColumn,
      previousColumn: columns.previousColumn,
      currentYear: years.current,
      previousYear: years.previous,
      ambiguousColumns: columns.ambiguous,
    };
  }

  private zoneText(sheet: ParsedSheet): string {
    const parts: string[] = [];
    for (let r = 0; r < Math.min(MAX_TEXT_SCAN_ROWS, sheet.grid.length); r += 1) {
      const row = sheet.grid[r] ?? [];
      for (let c = 0; c < Math.min(MAX_TEXT_SCAN_COLS, row.length); c += 1) {
        const text = cellText(row[c]);
        if (text) parts.push(text);
      }
    }
    return parts.join(' | ');
  }

  private detectYears(sheet: ParsedSheet): { current: number | null; previous: number | null } {
    // Los montos (p. ej. 2000.00) también caen en rango de años: solo valen
    // como evidencia anual la fila de encabezado y los títulos superiores.
    const headerRow = this.findHeaderRow(sheet);
    const years = new Set<number>();
    if (headerRow >= 0) {
      for (const year of this.rowYears(sheet.grid[headerRow] ?? [])) years.add(year);
      for (let r = 0; r < headerRow; r += 1) {
        for (const year of this.titleYears(sheet.grid[r] ?? [])) years.add(year);
      }
    } else {
      // Sin encabezado limpio (p. ej. layout matriz con años en filas):
      // solo valen frases de fecha de los títulos, nunca números sueltos.
      for (let r = 0; r < Math.min(6, sheet.grid.length); r += 1) {
        for (const year of this.titleYears(sheet.grid[r] ?? [])) years.add(year);
      }
    }
    const sorted = [...years].sort((a, b) => b - a);
    return { current: sorted[0] ?? null, previous: sorted[1] ?? null };
  }

  /** Años mencionados en una fila (número entero en rango o texto con año). */
  private rowYears(row: unknown[]): number[] {
    const years: number[] = [];
    for (const value of row) {
      if (typeof value === 'number' && Number.isInteger(value) && plausibleYear(value)) {
        years.push(value);
        continue;
      }
      const text = cellText(value);
      if (!text) continue;
      const direct = text.match(YEAR_CELL);
      if (direct && plausibleYear(Number(direct[1]))) years.push(Number(direct[1]));
    }
    return years;
  }

  /** Solo frases de fecha en títulos ("Al 31 de diciembre del 2025"). */
  private titleYears(row: unknown[]): number[] {
    const years: number[] = [];
    for (const value of row) {
      const text = cellText(value);
      if (!text) continue;
      const dated = text.match(SPANISH_DATE_YEAR);
      if (dated && plausibleYear(Number(dated[3]))) years.push(Number(dated[3]));
      const alone = text.match(/^(19\d{2}|20\d{2})$/);
      if (alone && plausibleYear(Number(alone[1]))) years.push(Number(alone[1]));
    }
    return years;
  }

  /** Fila con más evidencia anual entre filas SIN montos; -1 si no hay ninguna.
   * Las filas de datos (etiqueta + importes) quedan descalificadas aunque un
   * importe caiga en rango de años: evita que 2000.00 se lea como año 2000. */
  private findHeaderRow(sheet: ParsedSheet): number {
    let headerRow = -1;
    let headerHits = 0;
    for (let r = 0; r < Math.min(MAX_HEADER_SCAN_ROWS, sheet.grid.length); r += 1) {
      const row = sheet.grid[r] ?? [];
      if (this.hasAmountCell(row)) continue;
      const hits = this.rowYears(row).length;
      if (hits > headerHits) {
        headerHits = hits;
        headerRow = r;
      }
    }
    return headerRow;
  }

  private hasAmountCell(row: unknown[]): boolean {
    return row.some(
      (value) =>
        typeof value === 'number' &&
        Number.isFinite(value) &&
        !(Number.isInteger(value) && plausibleYear(value)),
    );
  }

  private detectColumns(
    sheet: ParsedSheet,
    years: { current: number | null; previous: number | null },
  ): {
    headerRow: number;
    labelColumn: number;
    currentColumn: number;
    previousColumn: number | null;
    ambiguous: boolean;
  } {
    const fallback = { headerRow: 0, labelColumn: 0, currentColumn: 1, previousColumn: 2 as number | null, ambiguous: true };
    if (years.current === null) return fallback;

    // Fila de encabezado: la que concentra más evidencia anual.
    const headerRow = this.findHeaderRow(sheet);
    if (headerRow < 0) return { ...fallback, ambiguous: true };

    const header = sheet.grid[headerRow] ?? [];
    const yearCols = (year: number): number[] => {
      const cols: number[] = [];
      header.forEach((value, col) => {
        if (typeof value === 'number' && value === year) cols.push(col);
        else {
          const match = cellText(value).match(YEAR_CELL);
          if (match && Number(match[1]) === year) cols.push(col);
        }
      });
      return cols;
    };
    const currentCols = yearCols(years.current);
    const previousCols = years.previous === null ? [] : yearCols(years.previous);
    // Año repetido en varias columnas o celda combinada "2025 - 2024": ambiguo.
    if (currentCols.length !== 1 || (years.previous !== null && previousCols.length !== 1)) {
      return { headerRow, labelColumn: 0, currentColumn: currentCols[0] ?? 1, previousColumn: previousCols[0] ?? null, ambiguous: true };
    }
    const currentColumn = currentCols[0];
    const previousColumn = years.previous === null ? null : previousCols[0];

    // Columna de descripción: la que concentra más texto en las filas de
    // datos a la izquierda de los años. Tolera columnas intermedias de
    // notas o códigos y datos que no empiezan en la columna A.
    const firstYearCol = Math.min(currentColumn, previousColumn ?? currentColumn);
    let labelColumn = 0;
    let bestCount = -1;
    for (let col = 0; col < firstYearCol; col += 1) {
      let count = 0;
      for (let r = headerRow + 1; r < sheet.grid.length; r += 1) {
        if (isLabelText((sheet.grid[r] ?? [])[col])) count += 1;
      }
      if (count > bestCount) {
        bestCount = count;
        labelColumn = col;
      }
    }
    return { headerRow, labelColumn, currentColumn, previousColumn, ambiguous: false };
  }
}
