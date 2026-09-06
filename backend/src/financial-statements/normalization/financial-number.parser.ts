import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type NumberParseKind = 'empty' | 'value' | 'invalid';

export interface NumberParseResult {
  kind: NumberParseKind;
  value?: Prisma.Decimal;
}

/**
 * Normaliza formatos numéricos contables sin inventar valores:
 * "1,234.56" | "1.234,56" | "(1,234.56)" | "-1,234.56" | "$ 1.234,56" | "1 234,56".
 * Celda vacía => empty (null según contexto). Cero real => 0.
 * Nunca convierte vacío en cero automáticamente.
 */
@Injectable()
export class FinancialNumberParser {
  parse(raw: unknown): NumberParseResult {
    if (raw === null || raw === undefined) return { kind: 'empty' };
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw)) return { kind: 'invalid' };
      const decimal = this.toDecimal(String(raw));
      return decimal === null ? { kind: 'invalid' } : { kind: 'value', value: decimal };
    }
    if (typeof raw === 'boolean') return { kind: 'invalid' };
    if (raw instanceof Date) return { kind: 'invalid' };
    if (typeof raw !== 'string') return { kind: 'invalid' };

    let text = raw.trim();
    if (text === '' || text === '-' || text === '—' || text === '–') return { kind: 'empty' };

    let negative = false;
    if (/^\(.*\)$/.test(text)) {
      negative = true;
      text = text.slice(1, -1).trim();
    }
    if (text.endsWith('-')) {
      negative = true;
      text = text.slice(0, -1).trim();
    }
    // Símbolos de moneda y códigos comunes (no aportan valor numérico).
    text = text.replace(/[$€£¥₡₲₡]/g, ' ');
    text = text.replace(/\b(USD|US\$|EUR|COP|MXN|PEN|S\/\.?|Bs\.?|Q|L\.?|RD\$|CLP|ARS)\b/gi, ' ');
    text = text.replace(/['\s\u00a0\u202f]/g, '');
    // Solo puede quedar dígitos, separadores y signo inicial.
    if (!/^-?[\d.,]+$/.test(text)) return { kind: 'invalid' };
    if (text.startsWith('-')) {
      negative = !negative;
      text = text.slice(1);
    }
    if (text === '') return { kind: 'invalid' };

    const normalized = this.normalizeSeparators(text);
    if (normalized === null) return { kind: 'invalid' };
    const value = this.toDecimal(negative ? `-${normalized}` : normalized);
    if (value === null) return { kind: 'invalid' };
    return { kind: 'value', value };
  }

  /**
   * Resuelve el separador decimal sin asumir configuración regional:
   * si hay '.' y ',' el último en aparecer es el decimal; con uno solo,
   * tres dígitos finales tras [1-9] indican miles, el resto decimal.
   */
  private normalizeSeparators(text: string): string | null {
    const hasDot = text.includes('.');
    const hasComma = text.includes(',');
    if (hasDot && hasComma) {
      const decimalSep = text.lastIndexOf('.') > text.lastIndexOf(',') ? '.' : ',';
      const thousandsSep = decimalSep === '.' ? ',' : '.';
      const cleaned = text.split(thousandsSep).join('');
      return decimalSep === ',' ? cleaned.replace(',', '.') : cleaned;
    }
    if (hasComma || hasDot) {
      const sep = hasComma ? ',' : '.';
      const parts = text.split(sep);
      if (parts.length > 2) {
        // Varios separadores iguales: todos menos el último son miles.
        const decimals = parts.pop() as string;
        return `${parts.join('')}.${decimals}`;
      }
      const [intPart, fracPart] = parts;
      if (fracPart === undefined || fracPart === '') return null;
      if (fracPart.length === 3 && /^[1-9]\d*$/.test(intPart)) {
        return `${intPart}${fracPart}`;
      }
      return `${intPart}.${fracPart}`;
    }
    return text;
  }

  private toDecimal(text: string): Prisma.Decimal | null {
    if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
    // El límite protege Decimal(18,2): solo cuentan los dígitos enteros.
    // El polvo float de Excel ("139558.13999999998") no debe rechazarse;
    // la columna lo redondea a 2 decimales al persistir.
    const integers = text.replace('-', '').split('.')[0] ?? '';
    if (integers.replace(/^0+/, '').length > 16) return null;
    try {
      return new Prisma.Decimal(text);
    } catch {
      return null;
    }
  }
}
