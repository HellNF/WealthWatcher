'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/cn'

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export type ToastVariant = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

/* ─── Context ───────────────────────────────────────────────────────────────── */

const ToastContext = createContext<ToastContextValue | null>(null)

/* ─── Provider ──────────────────────────────────────────────────────────────── */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev, { id, message, variant }])
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Portal-like stack — z-60 */}
      <div
        role="region"
        aria-label="Notifiche"
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/* ─── Single toast item ─────────────────────────────────────────────────────── */

const icons: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle2,
  error:   XCircle,
  info:    Info,
}

const itemStyles: Record<ToastVariant, string> = {
  success: 'border-l-2 border-l-[--brand]',
  error:   'border-l-2 border-l-[--danger]',
  info:    'border-l-2 border-l-[--info]',
}

const iconStyles: Record<ToastVariant, string> = {
  success: 'text-[--brand]',
  error:   'text-[--danger]',
  info:    'text-[--info]',
}

const AUTO_DISMISS_MS = 4000

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const Icon = icons[toast.variant]

  // Slide-up entrance
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Auto-dismiss
  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [toast.id, onDismiss])

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3',
        'bg-[--surface] border border-[--border] shadow-[--shadow-md]',
        'transition-all duration-150',
        // Slide-up: start at translate-y-2 opacity-0, end at translate-y-0 opacity-100
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2',
        // Reduced motion: skip transform
        'motion-reduce:translate-y-0',
        itemStyles[toast.variant],
      )}
      role="alert"
    >
      <Icon className={cn('size-4 shrink-0 mt-0.5', iconStyles[toast.variant])} />
      <p className="text-sm text-[--ink] flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-[--faint] hover:text-[--muted] transition-colors shrink-0 -mr-1"
        aria-label="Chiudi notifica"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

/* ─── Hook ──────────────────────────────────────────────────────────────────── */

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
