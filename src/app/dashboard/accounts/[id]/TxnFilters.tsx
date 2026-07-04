'use client'
import { useRouter, usePathname } from 'next/navigation'

interface Props {
  from?:  string
  to?:    string
  shown:  number
  total:  number
}

export default function TxnFilters({ from, to, shown, total }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  function navigate(newFrom?: string, newTo?: string, all?: boolean) {
    const params = new URLSearchParams()
    if (newFrom) params.set('from', newFrom)
    if (newTo)   params.set('to',   newTo)
    if (all)     params.set('all',  '1')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  const hasFilter = !!(from || to)

  return (
    <div className="flex items-end gap-3 flex-wrap text-sm">
      <div className="flex flex-col gap-0.5">
        <label htmlFor="txn-from" className="text-xs text-[--muted]">Da</label>
        <input
          id="txn-from"
          type="date"
          defaultValue={from ?? ''}
          max={to}
          onChange={(e) => navigate(e.target.value || undefined, to)}
          className="h-8 rounded-lg border border-[--border] bg-[--surface-2] px-2 text-sm text-[--ink] focus:outline-none focus:border-[--brand] focus:ring-1 focus:ring-[--ring] transition-colors"
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label htmlFor="txn-to" className="text-xs text-[--muted]">A</label>
        <input
          id="txn-to"
          type="date"
          defaultValue={to ?? ''}
          min={from}
          onChange={(e) => navigate(from, e.target.value || undefined)}
          className="h-8 rounded-lg border border-[--border] bg-[--surface-2] px-2 text-sm text-[--ink] focus:outline-none focus:border-[--brand] focus:ring-1 focus:ring-[--ring] transition-colors"
        />
      </div>
      {hasFilter && (
        <button
          onClick={() => navigate()}
          className="self-end h-8 px-2 text-xs text-[--muted] hover:text-[--danger] transition-colors"
        >
          Rimuovi filtri
        </button>
      )}
      <span className="self-end h-8 flex items-center text-xs text-[--faint]">
        {shown < total
          ? <>
              {shown} di {total} movimenti —{' '}
              <button
                onClick={() => navigate(from, to, true)}
                className="ml-1 text-[--brand-text] hover:underline"
              >
                mostra tutti
              </button>
            </>
          : <>{total} movimenti</>
        }
      </span>
    </div>
  )
}
