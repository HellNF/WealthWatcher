'use client'
import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from './Button'

interface ConfirmDeleteProps {
  /** Server action (già bound all'id) che esegue l'eliminazione */
  action: () => Promise<void>
  /** Testo del pulsante iniziale (default "Elimina") */
  label?: string
  /** Domanda di conferma mostrata prima dell'eliminazione */
  confirmText?: string
}

/**
 * Pulsante di eliminazione con conferma a due step (niente modale): un click
 * rivela "Sì, elimina / Annulla". Riusabile per conti, portafogli, istituzioni.
 */
export function ConfirmDelete({
  action,
  label = 'Elimina',
  confirmText = 'Sicuro? L\'operazione è irreversibile.',
}: ConfirmDeleteProps) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        <Trash2 className="size-3.5" />
        {label}
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-[--muted]">{confirmText}</span>
      <Button
        variant="danger"
        size="sm"
        loading={pending}
        onClick={() => startTransition(() => action())}
      >
        Sì, elimina
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={pending}>
        Annulla
      </Button>
    </div>
  )
}
