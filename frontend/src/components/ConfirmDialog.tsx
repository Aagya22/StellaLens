'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isOpen) setBusy(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel, busy]);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  if (!mounted) return null;

  // Portalled: the navbar's backdrop-filter would trap a fixed child inside it.
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(10px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => { if (!busy) onCancel(); }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-[380px] relative"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            style={{
              background: '#f6f5f3',
              borderRadius: '16px',
              padding: '32px 30px 26px',
              boxShadow: '0 30px 80px rgba(0,0,0,0.42)',
            }}
          >
            <div className="flex items-center gap-2.5 mb-4">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="var(--gold, #b3925e)" aria-hidden="true">
                <path d="M12 0c.7 6.4 5.1 11 12 12-6.9 1-11.3 5.6-12 12-.7-6.4-5.1-11-12-12 6.9-1 11.3-5.6 12-12z" />
              </svg>
              <span
                style={{
                  fontFamily: "var(--font-jost), sans-serif",
                  fontSize: '9px',
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--gold, #b3925e)',
                }}
              >
                StellaLens
              </span>
            </div>

            <h2
              style={{
                fontFamily: "var(--font-cormorant), serif",
                fontSize: '25px',
                fontWeight: 400,
                color: '#2a241f',
                lineHeight: 1.25,
              }}
            >
              {title}
            </h2>

            {message && (
              <p
                style={{
                  fontFamily: "var(--font-jost), sans-serif",
                  fontSize: '12.5px',
                  color: 'rgba(74,64,56,0.62)',
                  lineHeight: 1.65,
                  marginTop: '10px',
                }}
              >
                {message}
              </p>
            )}

            <div className="flex items-center gap-3 mt-7">
              <button
                onClick={onCancel}
                disabled={busy}
                className="cursor-pointer flex-1"
                style={{
                  background: 'none',
                  border: '1px solid rgba(74,64,56,0.22)',
                  borderRadius: '999px',
                  padding: '12px 18px',
                  fontFamily: "var(--font-jost), sans-serif",
                  fontSize: '10px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: '#2a241f',
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {cancelLabel}
              </button>
              <button
                onClick={() => void confirm()}
                disabled={busy}
                className="cursor-pointer flex-1"
                style={{
                  background: destructive ? '#8c2f28' : 'var(--gold, #b3925e)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '12px 18px',
                  fontFamily: "var(--font-jost), sans-serif",
                  fontSize: '10px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? 'Please wait…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
