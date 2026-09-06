import { z } from 'zod';
import type { AuditPeriod } from '../services/audit-periods.api';

const dateInput = z
  .string()
  .trim()
  .min(1, 'La fecha es requerida')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)');

const fiscalYear = z.coerce
  .number({ invalid_type_error: 'El año fiscal es requerido' })
  .int('El año fiscal debe ser entero')
  .min(1900, 'Año fiscal inválido')
  .max(2100, 'Año fiscal inválido');

function checkRange(
  data: { fiscalYear?: number; startDate?: string; endDate?: string },
  ctx: z.RefinementCtx,
) {
  const { startDate, endDate, fiscalYear: year } = data;
  if (startDate && endDate && endDate <= startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'La fecha de fin debe ser posterior a la fecha de inicio',
    });
  }
  if (typeof year === 'number' && startDate && endDate) {
    const startYear = Number(startDate.slice(0, 4));
    const endYear = Number(endDate.slice(0, 4));
    if (year < startYear || year > endYear) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fiscalYear'],
        message: 'El año fiscal debe estar dentro del rango de fechas',
      });
    }
  }
}

export const createAuditPeriodSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, 'La etiqueta es requerida')
      .max(255, 'Máximo 255 caracteres'),
    fiscalYear,
    startDate: dateInput,
    endDate: dateInput,
  })
  .superRefine(checkRange);

export const updateAuditPeriodSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, 'La etiqueta es requerida')
      .max(255, 'Máximo 255 caracteres'),
    startDate: dateInput,
    endDate: dateInput,
    status: z.enum(['OPEN', 'LOCKED', 'CLOSED']),
  })
  .superRefine((data, ctx) =>
    checkRange({ startDate: data.startDate, endDate: data.endDate }, ctx),
  );

export function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export interface AuditPeriodFormDefaults {
  label: string;
  fiscalYear: number | string;
  startDate: string;
  endDate: string;
  status?: 'OPEN' | 'LOCKED' | 'CLOSED';
}

export function auditPeriodToDefaults(period: AuditPeriod): AuditPeriodFormDefaults {
  return {
    label: period.label,
    fiscalYear: period.fiscalYear,
    startDate: toDateInput(period.startDate),
    endDate: toDateInput(period.endDate),
    status: period.status,
  };
}
