import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import api from '../lib/api';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  durationMs: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const durationMsRef = useRef(3000);

  useEffect(() => {
    api.get<{ ui: { toastDurationSeconds: number } }>('/api/config/public')
      .then(({ data }) => {
        const secs = data.ui?.toastDurationSeconds;
        if (typeof secs === 'number' && secs > 0) {
          durationMsRef.current = Math.max(1000, secs * 1000);
        }
      })
      .catch(() => {});
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = String(Date.now()) + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message, durationMs: durationMsRef.current }].slice(-5));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const { addToast } = useContext(ToastContext);
  return useMemo(() => ({
    success: (msg: string) => addToast('success', msg),
    error:   (msg: string) => addToast('error',   msg),
    warning: (msg: string) => addToast('warning', msg),
    info:    (msg: string) => addToast('info',    msg),
  }), [addToast]);
}

export function useToasts() {
  return useContext(ToastContext);
}
