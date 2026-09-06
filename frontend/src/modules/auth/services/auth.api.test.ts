import { describe, expect, it, vi } from 'vitest';

const { get, post, patch } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('../../../services/http-client', () => ({ httpClient: { get, post, patch } }));

import { changePassword, login, me } from './auth.api';

describe('auth api', () => {
  it('uses accessToken from POST /auth/login and loads the current user from /auth/me', async () => {
    post.mockResolvedValueOnce({ data: { accessToken: 'token-only' } });
    get.mockResolvedValueOnce({ data: { id: 'u1', email: 'admin@sistema.local', firstName: 'Admin', lastName: 'Sistema', organization: { id: 'development-organization', name: 'Development' }, roles: ['ADMIN'], permissions: [] } });

    await expect(login('admin@sistema.local', 'secret')).resolves.toEqual({ accessToken: 'token-only' });
    await expect(me()).resolves.toMatchObject({ email: 'admin@sistema.local' });
    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'admin@sistema.local', password: 'secret' });
    expect(get).toHaveBeenCalledWith('/auth/me');
  });
  it('sends password changes to the authenticated endpoint', async () => {
    patch.mockResolvedValueOnce({ data: { success: true } });
    await expect(changePassword('Actual123!', 'Nueva123!', 'Nueva123!')).resolves.toEqual({ success: true });
    expect(patch).toHaveBeenCalledWith('/auth/change-password', { currentPassword: 'Actual123!', newPassword: 'Nueva123!', confirmPassword: 'Nueva123!' });
  });
});
