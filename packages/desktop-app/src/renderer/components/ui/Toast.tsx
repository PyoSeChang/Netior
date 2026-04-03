import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

const ICON_MAP: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLOR_MAP: Record<ToastType, string> = {
  success: 'text-status-success',
  error: 'text-status-error',
  warning: 'text-status-warning',
  info: 'text-status-info',
};

// ─── Single Toast Entry ───────────────────────────────────────────

function ToastEntry({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}): JSX.Element {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // slide-in on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // auto-dismiss
  useEffect(() => {
    const dur = toast.duration ?? 4000;
    if (dur > 0) {
      timerRef.current = setTimeout(() => onDismiss(toast.id), dur);
      return () => clearTimeout(timerRef.current);
    }
  }, [toast.id, toast.duration, onDismiss]);

  const Icon = ICON_MAP[toast.type];
  const colors = COLOR_MAP[toast.type];
  const leadingIcon = toast.icon ?? <Icon size={18} />;

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-lg border border-subtle bg-surface-card px-4 py-3 text-sm text-default shadow-lg transition-all duration-200 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
      }`}
      style={{ minWidth: 280, maxWidth: 420 }}
    >
      <span className={`shrink-0 ${colors.split(' ')[0]}`}>
        {leadingIcon}
      </span>
      <div className="min-w-0 flex-1">
        {toast.title && (
          <div className="truncate text-sm font-medium text-default">{toast.title}</div>
        )}
        <div className="mt-0.5 break-words text-sm text-secondary">{toast.message}</div>
        {toast.actionLabel && toast.onAction && (
          <button
            className="mt-2 text-xs font-medium text-accent transition-colors hover:text-accent-hover"
            onClick={() => {
              toast.onAction?.();
              onDismiss(toast.id);
            }}
          >
            {toast.actionLabel}
          </button>
        )}
      </div>
      <button
        className="flex shrink-0 items-center justify-center rounded p-0.5 text-muted transition-colors hover:text-default"
        onClick={() => onDismiss(toast.id)}
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Global imperative API ────────────────────────────────────────

let addToastFn: ((toast: Omit<ToastItem, 'id'>) => void) | null = null;

export function showToast(type: ToastType, message: string, duration?: number) {
  if (!addToastFn) {
    console.warn('[Toast] ToastContainer not mounted');
    return;
  }
  addToastFn({ type, message, duration });
}

export function showCustomToast(toast: Omit<ToastItem, 'id'>) {
  if (!addToastFn) {
    console.warn('[Toast] ToastContainer not mounted');
    return;
  }
  addToastFn(toast);
}

// ─── Container (mount once in App) ────────────────────────────────

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[700] flex flex-col-reverse gap-2">
      {toasts.map((t) => (
        <ToastEntry key={t.id} toast={t} onDismiss={dismissToast} />
      ))}
    </div>,
    document.body,
  );
};
