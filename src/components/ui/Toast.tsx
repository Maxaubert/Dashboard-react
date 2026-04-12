import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

type ToastTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** Auto-dismiss after this many ms. Set 0 to keep open until clicked. */
  durationMs?: number;
}

interface ToastContextValue {
  toast: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * useToast — call from any component to show a toast.
 *
 *   const { toast } = useToast();
 *   toast({ tone: 'success', title: 'Lagret' });
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (next: Omit<Toast, 'id'>) => {
      const id = `t${++counter.current}`;
      const duration = next.durationMs ?? 3500;
      setToasts((prev) => [...prev, { ...next, id }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

interface ViewportProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function ToastViewport({ toasts, onDismiss }: ViewportProps) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}

const toneClasses: Record<ToastTone, string> = {
  neutral: 'border-[var(--color-border-strong)]',
  success: 'border-[color-mix(in_srgb,var(--color-success)_40%,transparent)]',
  warning: 'border-[color-mix(in_srgb,var(--color-warning)_40%,transparent)]',
  danger: 'border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)]',
  info: 'border-[color-mix(in_srgb,var(--color-info)_40%,transparent)]',
};

const toneAccent: Record<ToastTone, string> = {
  neutral: 'var(--color-text-dim)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      role="status"
      onClick={onDismiss}
      className={cn(
        'pointer-events-auto cursor-pointer rounded-xl border bg-[#0c0c0e]/95 backdrop-blur-xl',
        'p-3 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)]',
        'transition-all duration-200 ease-out',
        show ? 'translate-x-0 opacity-100' : 'translate-x-3 opacity-0',
        toneClasses[toast.tone]
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ background: toneAccent[toast.tone] }}
        />
        <div className="flex-1">
          <p className="text-[13px] font-medium text-[var(--color-text)]">{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-[12px] text-[var(--color-text-dim)]">{toast.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
