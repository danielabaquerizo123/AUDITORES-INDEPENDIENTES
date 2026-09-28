import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ToastContext, type ToastKind } from './toast-context';

type ToastItem = { id: number; message: string; kind: ToastKind };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems(current => current.filter(item => item.id !== id));
  }, []);
  const showToast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++nextId.current;
    setItems(current => [...current, { id, message, kind }]);
    timers.current.set(id, setTimeout(() => dismiss(id), 4000));
  }, [dismiss]);
  useEffect(() => () => { for (const timer of timers.current.values()) clearTimeout(timer); }, []);

  return <ToastContext.Provider value={{ showToast }}>
    {children}
    <div className="toast-host" aria-label="Notificaciones" aria-live="polite" aria-relevant="additions">
      {items.map(item => <div className={`app-toast app-toast--${item.kind}`} key={item.id} role={item.kind === 'error' ? 'alert' : 'status'}>
        <span className="app-toast__message">{item.message}</span>
        <button className="app-toast__close" type="button" aria-label="Cerrar notificación" onClick={() => dismiss(item.id)}>×</button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}
