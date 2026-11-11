'use client'
// Conferma o scarto di un pagamento ricorrente rilevato automaticamente.
import { useTransition } from 'react'
import { Check, X, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui'
import { cn } from '@/lib/cn'
import { clearRecurringDecisionAction, decideRecurringAction } from './recurring-actions'

const linkClass = 'inline-flex items-center gap-1 text-xs hover:underline disabled:opacity-50 cursor-pointer'

export function RecurringDecision({ itemKey, label, confirmed }: { itemKey: string; label: string; confirmed?: boolean }) {
  const [pending, start] = useTransition()
  if (confirmed) {
    return (
      <span className="inline-flex items-center gap-2">
        <Badge variant="neutral">confermato</Badge>
        <button type="button" disabled={pending} className={cn(linkClass, 'text-(--muted)')}
          onClick={() => start(() => clearRecurringDecisionAction(itemKey))}
          aria-label={`Annulla la conferma di ${label}`}>
          <Undo2 className="size-3" aria-hidden /> annulla
        </button>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-3">
      <button type="button" disabled={pending} className={cn(linkClass, 'text-(--brand-text)')}
        onClick={() => start(() => decideRecurringAction(itemKey, label, 'confirmed'))}>
        <Check className="size-3" aria-hidden /> Conferma
      </button>
      <button type="button" disabled={pending} className={cn(linkClass, 'text-(--muted)')}
        onClick={() => start(() => decideRecurringAction(itemKey, label, 'dismissed'))}>
        <X className="size-3" aria-hidden /> Non è ricorrente
      </button>
    </span>
  )
}

export function DismissedRecurring({ items }: { items: { key: string; label: string }[] }) {
  const [pending, start] = useTransition()
  if (items.length === 0) return null
  return (
    <div className="pt-3 border-t border-(--border) space-y-1.5">
      <p className="text-xs font-medium text-(--muted)">Scartati ({items.length}) · non usati da scadenziario e previsioni</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((d) => (
          <li key={d.key} className="text-xs text-(--muted) inline-flex items-center gap-1.5">
            <span className="[overflow-wrap:anywhere]">{d.label}</span>
            <button type="button" disabled={pending} className={cn(linkClass, 'text-(--brand-text)')}
              onClick={() => start(() => clearRecurringDecisionAction(d.key))}>
              <Undo2 className="size-3" aria-hidden /> ripristina
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
