import { afterEach, describe, expect, it, vi } from 'vitest';
const { invalidate, authToken } = vi.hoisted(() => ({ invalidate: vi.fn(), authToken: { value: null as string | null } }));
vi.mock('./session', () => ({ session: { get token() { return authToken.value; }, set: (value: string | null) => { authToken.value = value; }, invalidate } }));
import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios';
import { httpClient, resolveApiBaseUrl } from './http-client';
import { clientsApi } from '../modules/clients/services/clients.api';
import { auditorsApi } from '../modules/auditors/services/auditors.api';

const priorAdapter = httpClient.defaults.adapter;
const ok = (config: Parameters<AxiosAdapter>[0], data = {}) => ({ data, status: 200, statusText: 'OK', headers: {}, config } satisfies AxiosResponse);
const fail = (config: Parameters<AxiosAdapter>[0], status: number) => new AxiosError(`HTTP ${status}`, undefined, config, undefined, { data: {}, status, statusText: 'Error', headers: {}, config });

afterEach(() => { httpClient.defaults.adapter = priorAdapter; invalidate.mockClear(); authToken.value = null; vi.restoreAllMocks(); });

describe('http client session handling', () => {
  it('adds bearer token from the current in-memory session', async () => {
    authToken.value = 'abc123';
    httpClient.defaults.adapter = vi.fn(async config => ok(config)) as AxiosAdapter;
    await httpClient.get('/auth/me');
    expect((httpClient.defaults.adapter as ReturnType<typeof vi.fn>).mock.calls[0][0].headers.Authorization).toBe('Bearer abc123');
  });
  it('builds API URLs with a single api prefix', () => {
    const baseURL = resolveApiBaseUrl('https://auditores-independientes-production.up.railway.app/api');
    expect(axios.create({ baseURL }).getUri({ url: '/auth/login' })).toBe('https://auditores-independientes-production.up.railway.app/api/auth/login');
  });
  it('renews an expired access token and retries the original protected request once', async () => {
    authToken.value = 'expired';
    let protectedCalls = 0;
    const adapter = vi.fn(async config => {
      if (config.url === '/auth/refresh') return ok(config, { accessToken: 'fresh' });
      protectedCalls++;
      if (config.headers.Authorization !== 'Bearer fresh') throw fail(config, 401);
      return ok(config, { success: true });
    });
    httpClient.defaults.adapter = adapter as AxiosAdapter;
    await expect(httpClient.post('/clients', { legalName: 'test' })).resolves.toMatchObject({ data: { success: true } });
    expect(authToken.value).toBe('fresh');
    expect(protectedCalls).toBe(2);
    expect(adapter.mock.calls.filter(([config]) => config.url === '/auth/refresh')).toHaveLength(1);
    expect(invalidate).not.toHaveBeenCalled();
  });
  it('shares one refresh between simultaneous 401 responses', async () => {
    authToken.value = 'expired';
    let protectedCalls = 0;
    let refreshCalls = 0;
    const adapter = vi.fn(async config => {
      if (config.url === '/auth/refresh') { refreshCalls++; await new Promise(resolve => setTimeout(resolve, 20)); return ok(config, { accessToken: 'fresh' }); }
      protectedCalls++;
      if (config.headers.Authorization !== 'Bearer fresh') throw fail(config, 401);
      return ok(config);
    });
    httpClient.defaults.adapter = adapter as AxiosAdapter;
    await Promise.all([httpClient.get('/clients'), httpClient.get('/auditors'), httpClient.get('/contracts')]);
    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(6);
    expect(invalidate).not.toHaveBeenCalled();
  });
  it('allows consecutive client and auditor create requests after one renewal', async () => {
    authToken.value = 'expired';
    let refreshCalls = 0;
    let createAttempts = 0;
    let successfulCreates = 0;
    const adapter = vi.fn(async config => {
      if (config.url === '/auth/refresh') { refreshCalls++; return ok(config, { accessToken: 'fresh' }); }
      if (config.method === 'post' && ['/clients', '/auditors'].includes(config.url ?? '')) {
        createAttempts++;
        if (config.headers.Authorization !== 'Bearer fresh') throw fail(config, 401);
        successfulCreates++;
        return ok(config, { id: `created-${successfulCreates}` });
      }
      throw new Error(`Unexpected request: ${config.url}`);
    });
    httpClient.defaults.adapter = adapter as AxiosAdapter;
    const client = { legalName: 'Example', taxId: '0000000000001', economicActivity: 'Audit', email: 'test@example.test', representative: { treatment: 'Sr.', fullName: 'Test User', nationalId: '0000000000', position: 'Manager' } };
    const auditor = { fullName: 'Test Auditor', cedula: '0000000000', ruc: '0000000000001', professionalTitles: 'CPA', position: 'Auditor', externalAuditorRegistration: 'REG-1', judicialExpertNumber: 'PER-1', accountantLicenseNumber: 'MAT-1', address: 'Test address', phone: '0000000000', email: 'test@example.test' };
    for (let i = 0; i < 3; i++) await clientsApi.createClient(client);
    for (let i = 0; i < 3; i++) await auditorsApi.create(auditor);
    expect(createAttempts).toBe(7);
    expect(successfulCreates).toBe(6);
    expect(refreshCalls).toBe(1);
    expect(authToken.value).toBe('fresh');
    expect(invalidate).not.toHaveBeenCalled();
  });
  it.each([400, 409, 422, 500, 403])('does not invalidate the session on HTTP %i', async status => {
    authToken.value = 'still-valid';
    httpClient.defaults.adapter = vi.fn(async config => { throw fail(config, status); }) as AxiosAdapter;
    await expect(httpClient.post('/clients')).rejects.toMatchObject({ response: { status } });
    expect(invalidate).not.toHaveBeenCalled();
  });
  it('invalidates after refresh fails and does not enter a retry loop', async () => {
    authToken.value = 'expired';
    const adapter = vi.fn(async config => { throw fail(config, 401); });
    httpClient.defaults.adapter = adapter as AxiosAdapter;
    await expect(httpClient.get('/clients')).rejects.toMatchObject({ response: { status: 401 } });
    expect(adapter.mock.calls.filter(([config]) => config.url === '/auth/refresh')).toHaveLength(1);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
