import { Injectable } from '@nestjs/common';

export interface ContractValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missing: string[];
  unknown: string[];
}

function resolvePath(context: Record<string, unknown>, key: string): unknown {
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

function collectPaths(value: unknown, prefix: string, into: Set<string>): void {
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      into.add(path);
      collectPaths(child, path, into);
    }
  }
}

const VARIABLE_PATTERN = /{{\s*([\w.]+)\s*}}/g;

@Injectable()
export class ContractVariablesValidator {
  validate(context: Record<string, unknown>, bodies: string[]): ContractValidationResult {
    const known = new Set<string>();
    collectPaths(context, '', known);

    const missing: string[] = [];
    const unknown: string[] = [];
    for (const body of bodies) {
      for (const match of body.matchAll(VARIABLE_PATTERN)) {
        const key = match[1];
        if (!known.has(key)) {
          unknown.push(key);
          continue;
        }
        const value = resolvePath(context, key);
        if (value === undefined || value === null || value === '') missing.push(key);
      }
    }

    const errors: string[] = [];
    // Sin warnings provisionales: las fechas contractuales ya tienen
    // persistencia real y la validación es dirigida por plantilla.
    const warnings: string[] = [];
    for (const key of [...new Set(missing)]) {
      if (key === 'representative.name') {
        errors.push('El cliente no tiene un representante principal configurado.');
      } else if (key === 'report.deliveryDate' || key === 'taxReport.deliveryDate') {
        errors.push(`Fecha contractual sin valor: ${key}`);
      } else {
        errors.push(`Variable requerida sin valor: ${key}`);
      }
    }
    for (const key of [...new Set(unknown)]) {
      errors.push(`Variable desconocida: ${key}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      missing: [...new Set(missing)],
      unknown: [...new Set(unknown)],
    };
  }
}
