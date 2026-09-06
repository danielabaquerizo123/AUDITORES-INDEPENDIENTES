import axios, { type AxiosError } from 'axios';
import { session } from './session';

export function resolveApiBaseUrl(value: string | undefined): string {
  const baseUrl = value?.replace(/\/+$/, '');
  if (!baseUrl) return '/api';
  return /\/api$/i.test(baseUrl) ? baseUrl : `${baseUrl}/api`;
}

export const httpClient = axios.create({
  baseURL: resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

httpClient.interceptors.request.use((config) => { if (session.token) config.headers.Authorization = `Bearer ${session.token}`; return config; });
httpClient.interceptors.response.use((response) => response, (error: AxiosError) => { const url=error.config?.url ?? ''; if(error.response?.status===401 && !url.includes('/auth/login') && !url.includes('/auth/me'))session.invalidate(); return Promise.reject(error); });
