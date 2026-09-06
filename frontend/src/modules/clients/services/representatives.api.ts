import { httpClient } from '../../../services/http-client';

export interface Representative {
  id: string;
  clientId: string;
  /** Tratamiento del representante legal: Sr. | Sra. */
  treatment: string | null;
  fullName: string;
  nationalId: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  validFrom: string | null;
  validTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRepresentativePayload {
  treatment: string;
  fullName: string;
  nationalId: string;
  position: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
  validFrom?: string;
  validTo?: string;
}

export interface UpdateRepresentativePayload {
  treatment?: string;
  fullName?: string;
  nationalId?: string;
  position?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
  validFrom?: string;
  validTo?: string;
}

export const representativesApi = {
  getRepresentatives: async (clientId: string): Promise<Representative[]> =>
    (await httpClient.get<Representative[]>(`/clients/${clientId}/representatives`)).data,
  createRepresentative: async (
    clientId: string,
    payload: CreateRepresentativePayload,
  ): Promise<Representative> =>
    (await httpClient.post<Representative>(`/clients/${clientId}/representatives`, payload)).data,
  updateRepresentative: async (
    clientId: string,
    representativeId: string,
    payload: UpdateRepresentativePayload,
  ): Promise<Representative> =>
    (
      await httpClient.patch<Representative>(
        `/clients/${clientId}/representatives/${representativeId}`,
        payload,
      )
    ).data,
};
