'use client'
import { Trash2 } from 'lucide-react'
import { Button } from './Button'
import { ConfirmDialog } from './ConfirmDialog'

interface ConfirmDeleteProps {
  /** Server action (già bound all'id) che esegue l'eliminazione */
  action: () => Promise<unknown>
  /** Testo del pulsante (default "Elimina"); vuoto = solo icona, con tooltip */
  label?: string
  /** Domanda di conferma: diventa il titolo del dialogo */
  confirmText?: string
}

/**
 * Pulsante di eliminazione con dialogo di conferma (stesso ConfirmDialog usato
 * per regole, whitelist e movimenti): per conti, portafogli, istituzioni, beni,
 * mutui, obiettivi, budget e token. Neutro a riposo, rosso solo al passaggio.
 */
export function ConfirmDelete({
  action,
  label = 'Elimina',
  confirmText = 'Eliminare definitivamente?',
}: ConfirmDeleteProps) {
  const button = (
    <Button
      variant="ghost"
      size="sm"
      aria-label={label ? undefined : 'Elimina'}
      className="hover:text-(--danger-text) hover:bg-(--danger-subtle) data-popup-open:text-(--danger-text)"
    >
      <Trash2 className="size-3.5" />
      {label}
    </Button>
  )

  return (
    <ConfirmDialog
      title={confirmText}
      description="L’operazione non si può annullare."
      confirmLabel={label || 'Elimina'}
      onConfirm={action}
      tooltip={label ? undefined : 'Elimina'}
      trigger={button}
    />
  )
}
