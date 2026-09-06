import type { Representative } from './representatives.api';
import { httpClient } from '../../../services/http-client';

export type ClientStatus = 'ACTIVE' | 'INACTIVE';

export interface Client {
  representatives?: Representative[];
  _count?: { contracts: number };
  id: string;
  legalName: string;
  tradeName: string | null;
  taxId: string;
  economicActivity: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
}

/** Representante legal: 4 campos definitivos (tratamiento, nombre, cédula, cargo). */
export interface ClientRepresentativePayload {
  id?: string;
  treatment: string;
  fullName: string;
  nationalId: string;
  position: string;
}
export interface ClientPage { items: Client[]; total: number; page: number; pageSize: number; }

/** Empresa: 4 campos definitivos (razón social, RUC, actividad, correo). */
export interface CreateClientPayload {
  representative: ClientRepresentativePayload;
  legalName: string;
  taxId: string;
  economicActivity: string;
  email: string;
  country?: string;
}

export interface UpdateClientPayload {
  representative?: ClientRepresentativePayload;
  legalName?: string;
  taxId?: string;
  economicActivity?: string;
  email?: string;
  country?: string;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const data = (error as { response?: { data?: { message?: unknown }; status?: number } }).response?.data
      ?.message;
    if (typeof data === 'string' && data.length > 0) return data;
    if (Array.isArray(data)) {
      const first = data.find((item): item is string => typeof item === 'string');
      if (first) return first;
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function getApiStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null) {
    const status = (error as { response?: { status?: unknown } }).response?.status;
    if (typeof status === 'number') return status;
  }
  return undefined;
}

export const clientsApi = {
  getClientPage: async (page = 1, search = '', signal?: AbortSignal): Promise<ClientPage> => (await httpClient.get<ClientPage>('/clients', { params: { page, pageSize: 5, search }, signal })).data,
  getClients: async (): Promise<Client[]> => (await httpClient.get<Client[]>('/clients')).data,
  getClient: async (id: string): Promise<Client> =>
    (await httpClient.get<Client>(`/clients/${id}`)).data,
  createClient: async (payload: CreateClientPayload): Promise<Client> =>
    (await httpClient.post<Client>('/clients', payload)).data,
  updateClient: async (id: string, payload: UpdateClientPayload): Promise<Client> =>
    (await httpClient.patch<Client>(`/clients/${id}`, payload)).data,
  deleteClient: async (id: string): Promise<{ id: string; deletedAt: string; contractCount: number }> =>
    (await httpClient.delete(`/clients/${id}`)).data,
};
