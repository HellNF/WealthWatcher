'use client'
// src/components/ui/Toast.tsx — Notifiche con Sonner (swipe per chiudere,
// impilamento, pausa al passaggio del mouse, toast legati a una promessa).
// `useToast()` resta come prima per i componenti esistenti; per i casi nuovi
// si può importare direttamente `toast` (anche `toast.promise`).
import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner'
import { CheckCircle2, XCircle, Info, AlertTriangle, Loader2 } from 'lucide-react'
import { useTheme } from '@/components/providers/ThemeProvider'

export type ToastVariant = 'success' | 'error' | 'info'

export const toast = sonnerToast

function show(message: string, variant: ToastVariant = 'success') {
  sonnerToast[variant](message)
}

/** Compatibilità con l'API precedente: `const { toast } = useToast()`. */
export function useToast() {
  return { toast: show }
}

export function Toaster() {
  const { resolvedTheme } = useTheme()
  return (
    <SonnerToaster
      theme={resolvedTheme}
      position="bottom-right"
      // Sopra la barra home dell'iPhone (viewport-fit=cover)
      offset={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}
      mobileOffset={{ bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
      closeButton
      gap={8}
      icons={{
        success: <CheckCircle2 className="size-4 text-(--brand)" />,
        error:   <XCircle className="size-4 text-(--danger)" />,
        info:    <Info className="size-4 text-(--info)" />,
        warning: <AlertTriangle className="size-4 text-(--warning)" />,
        loading: <Loader2 className="size-4 animate-spin text-(--muted)" />,
      }}
      toastOptions={{
        closeButtonAriaLabel: 'Chiudi notifica',
        classNames: {
          toast: 'ww-toast',
          title: 'text-sm font-normal leading-snug',
          description: 'text-xs text-(--muted)',
        },
      }}
      containerAriaLabel="Notifiche"
    />
  )
}

/** Il provider non serve più (Sonner è globale): resta per non toccare il layout altrove. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  )
}
