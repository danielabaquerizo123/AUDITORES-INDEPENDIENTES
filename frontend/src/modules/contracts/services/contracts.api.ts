import { httpClient } from '../../../services/http-client';

export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'APPROVED' | 'CANCELLED';

export interface ContractTemplateClause {
  id: string;
  clauseKey: string;
  title: string;
  body: string;
  sortOrder: number;
  required: boolean;
  active: boolean;
}

export interface ContractTemplate {
  id: string;
  organizationId: string;
  name: string;
  version: number;
  description: string | null;
  active: boolean;
  clauses?: ContractTemplateClause[];
}

export interface ContractClause {
  id: string;
  clauseKey: string;
  title: string;
  body: string;
  sortOrder: number;
  enabled: boolean;
  isCustom?: boolean;
  parentClauseKey?: string | null;
}

export interface ContractSummary {
  updatedAt?: string;
  variables?: {templateVersion?: string};
  id: string;
  clientId: string;
  auditPeriodId: string;
  templateId: string | null;
  contractNumber: string | null;
  status: ContractStatus;
  signingDate: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  reportDeliveryDate: string | null;
  taxReportDeliveryDate: string | null;
  informationDeliveryDate: string | null;
  draftReportDueDate: string | null;
  feeNet: string | null;
  currency: string;
  notes: string | null;
  auditorId?: string | null;
  auditorSnapshot?: {fullName:string;professionalTitles:string;externalAuditorRegistration:string} | null;
  auditor?: {id:string;fullName:string;professionalTitles:string;externalAuditorRegistration:string} | null;
  template?: { id: string; name: string; version: number } | null;
  client?: { id: string; legalName: string; taxId: string };
  auditPeriod?: { id: string; label: string; fiscalYear: number };
  clauses?: ContractClause[];
}

export interface CreateContractPayload {
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
  currency?: string;
  notes?: string;
}

export interface UpdateContractPayload {
  sections?: {clauseKey:string;body:string}[];
  expectedUpdatedAt?: string;
  contractNumber?: string;
  signingDate?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  reportDeliveryDate?: string;
  taxReportDeliveryDate?: string;
  informationDeliveryDate?: string;
  draftReportDueDate?: string;
  feeNet?: string;
  currency?: string;
  notes?: string;
  status?: ContractStatus;
}

export interface ContractValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missing: string[];
  unknown: string[];
}

export interface PreviewSection {
  clauseKey: string;
  title: string;
  body: string;
}

export interface ContractPreview {
  contract: ContractSummary & { feeWords: string | null };
  sections: PreviewSection[];
  validation: ContractValidation;
}

export type BatchJobStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED';

export interface BatchItemResult {
  contractId: string;
  status: 'SUCCESS' | 'FAILED';
  documentId?: string;
  errors: string[];
}

export interface BatchJob {
  id: string;
  status: BatchJobStatus;
  format: 'docx' | 'pdf';
  total: number;
  processed: number;
  successful: number;
  failed: number;
  results: BatchItemResult[];
  createdAt: string;
  finishedAt: string | null;
}

export const TERMINAL_BATCH_STATUS: BatchJobStatus[] = [
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
];

export interface GeneratedDocumentMeta {
  id: string;
  contractId: string | null;
  auditPeriodId: string;
  type: string;
  status: string;
  title: string;
  originalFileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  templateVersion: string | null;
  generatedAt: string | null;
  createdAt: string;
}

async function downloadBlob(url: string, fileName: string): Promise<void> {
  const response = await httpClient.get<Blob>(url, { responseType: 'blob' });
  const objectUrl = URL.createObjectURL(response.data);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export const contractsApi = {
  prepareOfficial: async (clientId:string,auditedYear:number):Promise<ContractSummary> => (await httpClient.post<ContractSummary>('/contracts',{clientId,auditedYear})).data,
  getTemplates: async (): Promise<ContractTemplate[]> =>
    (await httpClient.get<ContractTemplate[]>('/contract-templates')).data,
  getContractByPeriod: async (periodId: string): Promise<ContractSummary> =>
    (await httpClient.get<ContractSummary>(`/audit-periods/${periodId}/contract`)).data,
  getContract: async (id: string): Promise<ContractSummary> =>
    (await httpClient.get<ContractSummary>(`/contracts/${id}`)).data,
  listContracts: async (): Promise<ContractSummary[]> =>
    (await httpClient.get<ContractSummary[]>('/contracts')).data,
  createContract: async (periodId: string, payload: CreateContractPayload): Promise<ContractSummary> =>
    (await httpClient.post<ContractSummary>(`/audit-periods/${periodId}/contracts`, payload)).data,
  updateContract: async (id: string, payload: UpdateContractPayload): Promise<ContractSummary> =>
    (await httpClient.patch<ContractSummary>(`/contracts/${id}`, payload)).data,
  assignAuditor: async(id:string,auditorId:string):Promise<ContractSummary>=>(await httpClient.patch<ContractSummary>(`/contracts/${id}/auditor`,{auditorId})).data,
  updateClause: async (contractId: string, clauseId: string, body: string): Promise<ContractClause> =>
    (await httpClient.patch<ContractClause>(`/contracts/${contractId}/clauses/${clauseId}`, { body })).data,
  createClause: async (contractId:string,payload:{title:string;body:string;insertBeforeClauseId?:string}):Promise<ContractClause> =>
    (await httpClient.post<ContractClause>(`/contracts/${contractId}/clauses`,payload)).data,
  createParagraph: async (contractId:string,clauseId:string,body:string):Promise<ContractClause> =>
    (await httpClient.post<ContractClause>(`/contracts/${contractId}/clauses/${clauseId}/paragraphs`,{body})).data,
  deleteClause: async (contractId:string,clauseId:string):Promise<{id:string;deleted:boolean}> =>
    (await httpClient.patch<{id:string;deleted:boolean}>(`/contracts/${contractId}/clauses/${clauseId}/delete`)).data,
  getPreview: async (id: string): Promise<ContractPreview> =>
    (await httpClient.get<ContractPreview>(`/contracts/${id}/preview`)).data,
  getValidation: async (id: string): Promise<ContractValidation> =>
    (await httpClient.get<ContractValidation>(`/contracts/${id}/variables/validate`)).data,
  generateDocument: async (id: string, format: 'docx' | 'pdf'): Promise<GeneratedDocumentMeta> =>
    (await httpClient.post<GeneratedDocumentMeta>(`/contracts/${id}/documents`, { format })).data,
  startBatch: async (contractIds: string[], format: 'docx' | 'pdf'): Promise<BatchJob> =>
    (await httpClient.post<BatchJob>('/contracts/generate-batch', { contractIds, format })).data,
  getBatch: async (jobId: string): Promise<BatchJob> =>
    (await httpClient.get<BatchJob>(`/contracts/generate-batch/${jobId}`)).data,
  listDocuments: async (id: string): Promise<GeneratedDocumentMeta[]> =>
    (await httpClient.get<GeneratedDocumentMeta[]>(`/contracts/${id}/documents`)).data,
  downloadDocument: async (contractId: string, doc: GeneratedDocumentMeta): Promise<void> =>
    downloadBlob(
      `/contracts/${contractId}/documents/${doc.id}/download`,
      doc.originalFileName ?? `documento.${doc.type === 'CONTRACT_PDF' ? 'pdf' : 'docx'}`,
    ),
};
