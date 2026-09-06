let accessToken: string | null = null; let onUnauthorized: (() => void) | null = null;
export const session = { get token() { return accessToken; }, set(token: string | null) { accessToken = token; }, onUnauthorized(callback: (() => void) | null) { onUnauthorized = callback; }, invalidate() { accessToken = null; onUnauthorized?.(); } };
