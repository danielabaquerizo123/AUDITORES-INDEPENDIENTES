import { httpClient } from '../../../services/http-client';
export type SessionUser = { id: string; email: string; firstName: string; lastName: string; organization: { id: string; name: string }; permissions: string[] };
export async function login(email: string, password: string) { return (await httpClient.post<{ accessToken: string }>('/auth/login', { email, password })).data; }
export async function me() { return (await httpClient.get<SessionUser>('/auth/me')).data; }
export async function changePassword(currentPassword: string, newPassword: string, confirmPassword: string) { return (await httpClient.patch<{ success: boolean }>('/auth/change-password', { currentPassword, newPassword, confirmPassword })).data; }
