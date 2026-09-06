import { httpClient } from '../../../services/http-client';
import type { Client } from '../../clients/services/clients.api';

export type AuditPeriodStatus = 'OPEN' | 'LOCKED' | 'CLOSED';

export interface AuditPeriod {
  id: string;
  clientId: string;
  label: string;
  fiscalYear: number;
  startDate: string;
  endDate: string;
  status: AuditPeriodStatus;
  lockedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditPeriodWithClient extends AuditPeriod {
  client: Client;
}

export interface CreateAuditPeriodPayload {
  label: string;
  fiscalYear: number;
  startDate: string;
  endDate: string;
}

export interface UpdateAuditPeriodPayload {
  label?: string;
  startDate?: string;
  endDate?: string;
  status?: AuditPeriodStatus;
}

export const auditPeriodsApi = {
  getAuditPeriods: async (clientId: string): Promise<AuditPeriod[]> =>
    (await httpClient.get<AuditPeriod[]>(`/clients/${clientId}/audit-periods`)).data,
  getAuditPeriod: async (id: string): Promise<AuditPeriodWithClient> =>
    (await httpClient.get<AuditPeriodWithClient>(`/audit-periods/${id}`)).data,
  createAuditPeriod: async (
    clientId: string,
    payload: CreateAuditPeriodPayload,
  ): Promise<AuditPeriod> =>
    (await httpClient.post<AuditPeriod>(`/clients/${clientId}/audit-periods`, payload)).data,
  updateAuditPeriod: async (
    id: string,
    payload: UpdateAuditPeriodPayload,
  ): Promise<AuditPeriod> =>
    (await httpClient.patch<AuditPeriod>(`/audit-periods/${id}`, payload)).data,
};
