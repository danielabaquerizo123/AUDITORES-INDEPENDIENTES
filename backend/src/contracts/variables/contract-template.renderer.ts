import { Injectable } from '@nestjs/common';

export interface ClauseInput {
  clauseKey: string;
  title: string;
  body: string;
  sortOrder: number;
}

export interface RenderedClause {
  clauseKey: string;
  title: string;
  body: string;
}

const VARIABLE_PATTERN = /{{\s*([\w.]+)\s*}}/g;

export function resolveVariable(context: Record<string, unknown>, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (value, part) =>
        value && typeof value === 'object'
          ? (value as Record<string, unknown>)[part]
          : undefined,
      context,
    );
}

export function formatVariable(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') {
    try {
      const text = value.toString();
      if (text !== '[object Object]') return text;
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Single source of truth for template rendering: preview, DOCX and PDF
 * all resolve TEMPLATE + CONTEXT through this renderer. No global replaces.
 */
@Injectable()
export class ContractTemplateRenderer {
  renderBody(body: string, context: Record<string, unknown>): string {
    return body.replace(VARIABLE_PATTERN, (_, key: string) =>
      formatVariable(resolveVariable(context, key)),
    );
  }

  renderClauses(clauses: ClauseInput[], context: Record<string, unknown>): RenderedClause[] {
    return [...clauses]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((clause) => ({
        clauseKey: clause.clauseKey,
        title: clause.title,
        body: this.renderBody(clause.body, context),
      }));
  }
}
