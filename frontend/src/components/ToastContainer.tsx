import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToasts, type Toast, type ToastType } from '../context/ToastContext';

const TYPE_STYLES: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: 'bg-green-50',  border: 'border-green-400',  icon: '✓', text: 'text-green-800'  },
  error:   { bg: 'bg-red-50',    border: 'border-red-400',    icon: '✕', text: 'text-red-800'    },
  warning: { bg: 'bg-orange-50', border: 'border-orange-400', icon: '⚠', text: 'text-orange-800' },
  info:    { bg: 'bg-sky-50',    border: 'border-sky-400',    icon: 'ℹ', text: 'text-sky-800'    },
};

type Phase = 'entering' | 'visible' | 'exiting';

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [phase, setPhase] = useState<Phase>('entering');
  const startedRef = useRef(false);
  const s = TYPE_STYLES[toast.type];

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const raf = requestAnimationFrame(() => setPhase('visible'));
    const timer = setTimeout(() => {
      setPhase('exiting');
      setTimeout(onRemove, 500);
    }, toast.durationMs);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function dismiss() {
    if (phase === 'exiting') return;
    setPhase('exiting');
    setTimeout(onRemove, 500);
  }

  return (
    <div
      onClick={dismiss}
      style={{
        transform: phase === 'entering' ? 'translateX(100%)' : 'translateX(0)',
        opacity: phase === 'visible' ? 1 : 0,
        transition: phase === 'exiting'
          ? 'opacity 500ms ease'
          : 'transform 300ms ease, opacity 300ms ease',
      }}
      className={`flex items-start gap-3 w-80 px-4 py-3 rounded-xl border shadow-lg cursor-pointer select-none ${s.bg} ${s.border} ${s.text}`}
    >
      <span className="text-sm font-bold mt-0.5 shrink-0 w-4 text-center">{s.icon}</span>
      <span className="text-sm font-medium leading-snug flex-1 min-w-0">{toast.message}</span>
      <span className="text-xs opacity-40 hover:opacity-80 shrink-0 mt-0.5 transition-opacity">✕</span>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToasts();

  return createPortal(
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col-reverse gap-2 items-end pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onRemove={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
