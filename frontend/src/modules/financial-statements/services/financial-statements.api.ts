import { httpClient } from '../../../services/http-client';

export type FinancialImportStatus =
  | 'UPLOADED'
  | 'PROCESSING'
  | 'REVIEW_REQUIRED'
  | 'PROCESSED'
  | 'FAILED';

export type FinancialStatementType =
  | 'FINANCIAL_POSITION'
  | 'COMPREHENSIVE_INCOME'
  | 'CHANGES_IN_EQUITY'
  | 'CASH_FLOW';

export interface FinancialImport {
  id: string;
  auditPeriodId: string;
  uploadedById: string | null;
  originalFileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  status: FinancialImportStatus;
  version: number;
  attemptCount: number;
  currentYear: number | null;
  previousYear: number | null;
  processingError: string | null;
  detectionSummary: DetectedSummary[] | null;
  validationIssues: ValidationIssue[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface DetectedSummary {
  type: FinancialStatementType;
  sheetName: string;
  confidence: number;
  currentYear: number | null;
  previousYear: number | null;
  lineCount: number;
  unclassified: number;
}

export interface ValidationIssue {
  code: string;
  message: string;
  statementType?: FinancialStatementType;
  sheetName?: string;
  sourceRow?: number;
}

export interface FinancialStatementLine {
  id: string;
  sortOrder: number;
  rawLabel: string;
  normalizedKey: string | null;
  classified: boolean;
  classificationSource: 'AUTO' | 'MANUAL';
  sheetName: string | null;
  sourceRow: number | null;
  currentValue: string | null;
  previousValue: string | null;
  difference: string | null;
  percentageChange: string | null;
}

export interface FinancialStatement {
  id: string;
  type: FinancialStatementType;
  sheetName: string | null;
  currentYear: number | null;
  previousYear: number | null;
  detected: boolean;
  confidence: number | null;
  lineCount: number;
  lines: FinancialStatementLine[];
}

export interface ReclassifyResult {
  id: string;
  statementId: string;
  rawLabel: string;
  normalizedKey: string | null;
  classified: boolean;
  classificationSource: 'AUTO' | 'MANUAL';
  currentValue: string | null;
  previousValue: string | null;
  difference: string | null;
  percentageChange: string | null;
  importStatus: string;
}

export interface ProcessResult {
  id: string;
  status: FinancialImportStatus;
  issues: ValidationIssue[];
  statements: DetectedSummary[];
}
export interface WorkbookPreview { sheets: { name: string; grid: unknown[][]; rowOffset: number; colOffset: number }[]; detected: { type: FinancialStatementType; sheetName: string; confidence: number }[]; }

export const STATEMENT_LABELS: Record<FinancialStatementType, string> = {
  FINANCIAL_POSITION: 'Situación Financiera',
  COMPREHENSIVE_INCOME: 'Resultados',
  CHANGES_IN_EQUITY: 'Cambios en Patrimonio',
  CASH_FLOW: 'Flujo de Efectivo',
};

export const IMPORT_STATUS_LABELS: Record<FinancialImportStatus, string> = {
  UPLOADED: 'Subido',
  PROCESSING: 'Procesando',
  REVIEW_REQUIRED: 'Requiere revisión',
  PROCESSED: 'Procesado',
  FAILED: 'Fallido',
};

export function formatAmount(value: string | null): string {
  if (value === null) return '—';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return parsed.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPercent(value: string | null): string {
  if (value === null) return '—';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return `${parsed.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const financialStatementsApi = {
  previewImport: async (file: File): Promise<WorkbookPreview> => { const form = new FormData(); form.append('file', file); return (await httpClient.post<WorkbookPreview>('/financial-imports/preview', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data; },
  listImports: async (periodId: string): Promise<FinancialImport[]> =>
    (await httpClient.get<FinancialImport[]>(`/audit-periods/${periodId}/financial-imports`)).data,
  uploadImport: async (periodId: string, file: File): Promise<FinancialImport> => {
    const form = new FormData();
    form.append('file', file);
    return (
      await httpClient.post<FinancialImport>(`/audit-periods/${periodId}/financial-imports`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    ).data;
  },
  processImport: async (id: string): Promise<ProcessResult> =>
    (await httpClient.post<ProcessResult>(`/financial-imports/${id}/process`)).data,
  getImport: async (id: string): Promise<FinancialImport> =>
    (await httpClient.get<FinancialImport>(`/financial-imports/${id}`)).data,
  getStatements: async (id: string): Promise<FinancialStatement[]> =>
    (await httpClient.get<FinancialStatement[]>(`/financial-imports/${id}/statements`)).data,
  getCatalog: async (): Promise<Record<FinancialStatementType, string[]>> =>
    (await httpClient.get<Record<FinancialStatementType, string[]>>('/financial-statement-keys')).data,
  reclassifyLine: async (lineId: string, normalizedKey: string): Promise<ReclassifyResult> =>
    (
      await httpClient.patch<ReclassifyResult>(
        `/financial-statement-lines/${lineId}/classification`,
        { normalizedKey },
      )
    ).data,
};
