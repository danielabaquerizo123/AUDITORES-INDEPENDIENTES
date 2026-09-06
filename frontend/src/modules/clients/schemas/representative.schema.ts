import { z } from 'zod';
import type { Representative } from '../services/representatives.api';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .or(z.literal(''));

const optionalEmail = z
  .string()
  .trim()
  .email('Email inválido')
  .optional()
  .or(z.literal(''));

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)')
  .optional()
  .or(z.literal(''));

const baseFields = {
  treatment: z.enum(['Sr.', 'Sra.'], {
    errorMap: () => ({ message: 'Seleccione Sr. o Sra.' }),
  }),
  fullName: z
    .string()
    .trim()
    .min(1, 'El nombre es requerido')
    .max(255, 'Máximo 255 caracteres'),
  nationalId: optionalText(64),
  position: optionalText(120),
  email: optionalEmail,
  phone: optionalText(64),
  isPrimary: z.boolean().optional().default(false),
  validFrom: optionalDate,
  validTo: optionalDate,
};

function checkRange(
  data: { validFrom?: string; validTo?: string },
  ctx: z.RefinementCtx,
) {
  const from = data.validFrom?.trim();
  const to = data.validTo?.trim();
  if (from && to && to < from) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['validTo'],
      message: 'La vigencia hasta no puede ser anterior a la vigencia desde',
    });
  }
}

export const createRepresentativeSchema = z
  .object(baseFields)
  .superRefine(checkRange);

export const updateRepresentativeSchema = z
  .object(baseFields)
  .superRefine(checkRange);

/** Convierte "" en undefined para no enviar opcionales vacíos al backend. */
export function cleanOptional(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export interface RepresentativeFormDefaults {
  treatment?: string;
  fullName: string;
  nationalId?: string;
  position?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
  validFrom?: string;
  validTo?: string;
}

export function representativeToDefaults(rep: Representative): RepresentativeFormDefaults {
  return {
    treatment: rep.treatment ?? 'Sr.',
    fullName: rep.fullName,
    nationalId: rep.nationalId ?? '',
    position: rep.position ?? '',
    email: rep.email ?? '',
    phone: rep.phone ?? '',
    isPrimary: rep.isPrimary,
    validFrom: toDateInput(rep.validFrom),
    validTo: toDateInput(rep.validTo),
  };
}
