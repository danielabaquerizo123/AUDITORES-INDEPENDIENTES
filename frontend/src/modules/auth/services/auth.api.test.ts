import { describe, expect, it, vi } from 'vitest';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../../../services/http-client', () => ({ httpClient: { get, post } }));

import { login, me } from './auth.api';

describe('auth api', () => {
  it('uses accessToken from POST /auth/login and loads the current user from /auth/me', async () => {
    post.mockResolvedValueOnce({ data: { accessToken: 'token-only' } });
    get.mockResolvedValueOnce({ data: { id: 'u1', email: 'admin@sistema.local', firstName: 'Admin', lastName: 'Sistema', organization: { id: 'development-organization', name: 'Development' }, roles: ['ADMIN'], permissions: [] } });

    await expect(login('admin@sistema.local', 'secret')).resolves.toEqual({ accessToken: 'token-only' });
    await expect(me()).resolves.toMatchObject({ email: 'admin@sistema.local' });
    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'admin@sistema.local', password: 'secret' });
    expect(get).toHaveBeenCalledWith('/auth/me');
  });
});
