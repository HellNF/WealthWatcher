'use client'
// src/components/ui/ConfirmDialog.tsx — Conferma per azioni distruttive e
// irreversibili (base-ui AlertDialog) al posto di window.confirm(): stessa
// grafica dell'app, focus intrappolato, Esc per annullare. Il fondale scurisce
// la pagina (compito modale); il pannello nasce dal centro con scala breve.
// Da usare con parsimonia: per gli annullabili meglio un "Annulla" nel toast.
import { useState, useTransition } from 'react'
import { unstable_rethrow } from 'next/navigation'
import { AlertDialog } from '@base-ui/react/alert-dialog'
import { buttonVariants } from './Button'
import { toast } from './Toast'
import { Tooltip } from './Tooltip'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ConfirmDialogProps {
  /** Elemento che apre il dialogo (un <button>) */
  trigger: React.ReactElement
  title: string
  description?: React.ReactNode
  /** Testo del pulsante distruttivo (default "Elimina") */
  confirmLabel?: string
  /**
   * Azione eseguita alla conferma; il dialogo resta aperto finché non finisce.
   * Se restituisce `{ error }` (come le server action dell'app) l'errore
   * compare in un toast invece di perdersi.
   */
  onConfirm: () => unknown
  /** Tooltip sul pulsante (per i pulsanti solo icona) */
  tooltip?: string
  /** Solo per prove visive: dialogo aperto al primo render */
  defaultOpen?: boolean
}

export function ConfirmDialog({
  trigger, title, description, confirmLabel = 'Elimina', onConfirm, tooltip, defaultOpen = false,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [pending, startTransition] = useTransition()

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => { if (!pending) setOpen(next) }}>
      {tooltip
        ? <Tooltip content={tooltip}><AlertDialog.Trigger render={trigger} /></Tooltip>
        : <AlertDialog.Trigger render={trigger} />}
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className={cn(
            'fixed inset-0 min-h-dvh bg-black/30 dark:bg-black/60 supports-[-webkit-touch-callout:none]:absolute',
            'transition-opacity duration-200 ease-out-strong data-starting-style:opacity-0 data-ending-style:opacity-0',
          )}
        />
        <AlertDialog.Popup
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-sm',
            'rounded-2xl bg-(--surface) p-5 ring-1 ring-(--border) shadow-[var(--shadow-lg),var(--highlight)]',
            'transition-[scale,opacity] duration-200 ease-out-strong',
            'data-starting-style:opacity-0 data-starting-style:scale-[0.96]',
            'data-ending-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:duration-150',
            'motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100',
          )}
        >
          <AlertDialog.Title className="text-base font-semibold text-(--ink) text-balance [overflow-wrap:anywhere]">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-1.5 text-sm text-(--muted) text-pretty">
              {description}
            </AlertDialog.Description>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close
              disabled={pending}
              className={buttonVariants({ variant: 'secondary' })}
            >
              Annulla
            </AlertDialog.Close>
            <button
              type="button"
              disabled={pending}
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => startTransition(async () => {
                try {
                  const result = await onConfirm()
                  if (result && typeof result === 'object' && 'error' in result && result.error) {
                    toast.error(String(result.error))
                  }
                } catch (err) {
                  unstable_rethrow(err) // redirect()/notFound() delle server action devono passare
                  toast.error('Operazione non riuscita. Riprova.')
                }
                setOpen(false)
              })}
            >
              {pending && <Loader2 className="size-3.5 animate-spin shrink-0" />}
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
