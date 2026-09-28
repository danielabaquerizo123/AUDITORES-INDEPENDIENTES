import { createContext } from 'react';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';
export type ToastApi = { showToast: (message: string, kind?: ToastKind) => void };
export const ToastContext = createContext<ToastApi>({ showToast: () => undefined });
