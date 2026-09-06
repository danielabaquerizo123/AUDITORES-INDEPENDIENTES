import { z } from 'zod';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .or(z.literal(''));

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)')
  .optional()
  .or(z.literal(''));

const optionalFee = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'Honorarios inválidos (ej. 1500.00)')
  .optional()
  .or(z.literal(''));

export const createContractSchema = z.object({
  templateId: z.string().min(1, 'Seleccione una plantilla'),
  contractNumber: optionalText(64),
  signingDate: optionalDate,
  effectiveFrom: optionalDate,
  effectiveTo: optionalDate,
  reportDeliveryDate: optionalDate,
  taxReportDeliveryDate: optionalDate,
  informationDeliveryDate: optionalDate,
  draftReportDueDate: optionalDate,
  feeNet: optionalFee,
  currency: z.string().trim().length(3, 'Moneda: 3 letras (ej. USD)').regex(/^[A-Za-z]{3}$/, 'Moneda: 3 letras (ej. USD)'),
  notes: optionalText(1000),
});

export const updateContractSchema = z.object({
  contractNumber: optionalText(64),
  signingDate: optionalDate,
  effectiveFrom: optionalDate,
  effectiveTo: optionalDate,
  reportDeliveryDate: optionalDate,
  taxReportDeliveryDate: optionalDate,
  informationDeliveryDate: optionalDate,
  draftReportDueDate: optionalDate,
  feeNet: optionalFee,
  currency: z.string().trim().length(3, 'Moneda: 3 letras (ej. USD)').regex(/^[A-Za-z]{3}$/, 'Moneda: 3 letras (ej. USD)'),
  notes: optionalText(1000),
  status: z.enum(['DRAFT', 'ACTIVE', 'APPROVED', 'CANCELLED']),
});

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

export interface ContractFormDefaults {
  templateId: string;
  contractNumber?: string;
  signingDate?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  reportDeliveryDate?: string;
  taxReportDeliveryDate?: string;
  informationDeliveryDate?: string;
  draftReportDueDate?: string;
  feeNet?: string;
  currency: string;
  notes?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'APPROVED' | 'CANCELLED';
}
