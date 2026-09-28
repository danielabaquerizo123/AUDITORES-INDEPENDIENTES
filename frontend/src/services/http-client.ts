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
type RetryConfig = NonNullable<AxiosError['config']> & { _authRetry?: boolean };
let refreshInFlight: Promise<string | null> | null = null;
const excludedFromRefresh = (url: string) => ['/auth/login', '/auth/refresh', '/auth/logout'].some((path) => url.includes(path));

httpClient.interceptors.response.use((response) => response, async (error: AxiosError) => {
  if (error.response?.status !== 401) return Promise.reject(error);
  const config = error.config as RetryConfig | undefined;
  const url = config?.url ?? '';
  if (!config || excludedFromRefresh(url)) return Promise.reject(error);
  if (config._authRetry) {
    session.invalidate();
    return Promise.reject(error);
  }
  config._authRetry = true;
  if (!refreshInFlight) {
    refreshInFlight = httpClient.post<{ accessToken: string }>('/auth/refresh', {}, { withCredentials: true })
      .then(({ data }) => { session.set(data.accessToken); return data.accessToken; })
      .catch(() => { session.invalidate(); return null; })
      .finally(() => { refreshInFlight = null; });
  }
  const accessToken = await refreshInFlight;
  if (!accessToken) return Promise.reject(error);
  config.headers.Authorization = `Bearer ${accessToken}`;
  return httpClient(config);
});
