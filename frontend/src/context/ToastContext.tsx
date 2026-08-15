'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type ToastKind = 'success' | 'error' | 'info';

interface ToastInput {
  kind?: ToastKind;
  title: string;
  message?: string;
  duration?: number;
}

interface Toast extends Required<Omit<ToastInput, 'message'>> {
  id: number;
  message?: string;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ACCENT: Record<ToastKind, string> = {
  success: '#7a8a6f',
  error: '#b3261e',
  info: 'var(--gold, #b3925e)',
};

const Glyph = ({ kind }: { kind: ToastKind }) => {
  const common = {
    width: 13,
    height: 13,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: ACCENT[kind],
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (kind === 'success') return <svg {...common}><path d="M20 6L9 17l-5-5" /></svg>;
  if (kind === 'error') return <svg {...common}><path d="M18 6L6 18M6 6l12 12" /></svg>;
  return <svg {...common}><path d="M12 8h.01M11 12h1v4h1" /><circle cx="12" cy="12" r="9" /></svg>;
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ kind = 'success', title, message, duration }: ToastInput) => {
      const id = nextId.current++;
      const ms = duration ?? (kind === 'error' ? 6000 : 3200);

      setToasts((prev) => {
        const withoutDuplicate = prev.filter((t) => {
          if (t.title !== title) return true;
          const timer = timers.current.get(t.id);
          if (timer) clearTimeout(timer);
          timers.current.delete(t.id);
          return false;
        });
        return [...withoutDuplicate, { id, kind, title, message, duration: ms }].slice(-4);
      });

      timers.current.set(id, setTimeout(() => dismiss(id), ms));
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed z-[300] flex flex-col items-end gap-2.5 pointer-events-none"
        style={{ bottom: '24px', right: '24px', maxWidth: 'calc(100vw - 48px)' }}
        aria-live="polite"
        role="status"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => dismiss(t.id)}
              className="pointer-events-auto cursor-pointer flex items-start gap-3"
              style={{
                minWidth: '260px',
                maxWidth: '340px',
                background: '#f6f5f3',
                border: '1px solid rgba(74,64,56,0.1)',
                borderLeft: `2px solid ${ACCENT[t.kind]}`,
                padding: '13px 16px',
                boxShadow: '0 14px 40px rgba(0,0,0,0.14)',
                fontFamily: "var(--font-jost), sans-serif",
              }}
            >
              <span style={{ lineHeight: 0, marginTop: '2px', flexShrink: 0 }}>
                <Glyph kind={t.kind} />
              </span>
              <span className="flex flex-col gap-0.5 min-w-0">
                <span
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: '#2a241f',
                    fontWeight: 500,
                  }}
                >
                  {t.title}
                </span>
                {t.message && (
                  <span
                    style={{
                      fontSize: '11.5px',
                      color: 'rgba(74,64,56,0.62)',
                      lineHeight: 1.5,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {t.message}
                  </span>
                )}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
