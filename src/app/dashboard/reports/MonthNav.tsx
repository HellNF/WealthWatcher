'use client'

// Navigazione del Report: stepper ‹ mese › + select per salti lontani.
// Scala a qualsiasi profondità di storico senza esplodere in righe di pill.
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface AccountOption { id: number; name: string }

interface Props {
  months:    string[]          // YYYY-MM, dal più recente
  month:     string            // mese selezionato
  accounts:  AccountOption[]
  accountId: number | null
}

const MONTH_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function label(m: string): string {
  return `${MONTH_SHORT[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}`
}

function href(month: string, accountId: number | null): string {
  const params = new URLSearchParams({ month })
  if (accountId !== null) params.set('account', String(accountId))
  return `/dashboard/reports?${params.toString()}`
}

export default function MonthNav({ months, month, accounts, accountId }: Props) {
  const router = useRouter()

  const idx  = months.indexOf(month)
  // months è ordinato dal più recente: "precedente" = indice successivo
  const prev = idx >= 0 && idx < months.length - 1 ? months[idx + 1] : null
  const next = idx > 0 ? months[idx - 1] : null

  const stepClass = (enabled: boolean) => [
    'flex size-8 items-center justify-center rounded-lg border border-[--border] transition-colors duration-150',
    enabled
      ? 'text-[--muted] hover:text-[--ink] hover:bg-[--surface-2]'
      : 'text-[--faint] opacity-40 pointer-events-none',
  ].join(' ')

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <nav aria-label="Mese del report" className="flex items-center gap-1.5">
        {prev ? (
          <Link href={href(prev, accountId)} className={stepClass(true)} aria-label={`Mese precedente, ${label(prev)}`}>
            <ChevronLeft className="size-4" strokeWidth={1.75} />
          </Link>
        ) : (
          <span className={stepClass(false)} aria-hidden><ChevronLeft className="size-4" strokeWidth={1.75} /></span>
        )}

        <label className="sr-only" htmlFor="report-month">Mese</label>
        <select
          id="report-month"
          value={month}
          onChange={(e) => router.push(href(e.target.value, accountId))}
          className="h-8 rounded-lg border border-[--border] bg-[--surface-2] px-2.5 text-sm font-medium text-[--ink] tabular-nums focus:outline-none focus:ring-2 focus:ring-[--ring]"
        >
          {months.map((m) => (
            <option key={m} value={m}>{label(m)}</option>
          ))}
        </select>

        {next ? (
          <Link href={href(next, accountId)} className={stepClass(true)} aria-label={`Mese successivo, ${label(next)}`}>
            <ChevronRight className="size-4" strokeWidth={1.75} />
          </Link>
        ) : (
          <span className={stepClass(false)} aria-hidden><ChevronRight className="size-4" strokeWidth={1.75} /></span>
        )}
      </nav>

      {accounts.length > 1 && (
        accounts.length <= 3 ? (
          <nav aria-label="Filtro conto" className="flex gap-0.5 flex-wrap p-1 bg-[--surface-2] rounded-xl">
            <Link
              href={href(month, null)}
              aria-current={accountId === null ? 'true' : undefined}
              className={pillClass(accountId === null)}
            >
              Tutti i conti
            </Link>
            {accounts.map((acc) => (
              <Link
                key={acc.id}
                href={href(month, acc.id)}
                aria-current={accountId === acc.id ? 'true' : undefined}
                className={pillClass(accountId === acc.id)}
              >
                {acc.name}
              </Link>
            ))}
          </nav>
        ) : (
          <>
            <label className="sr-only" htmlFor="report-account">Conto</label>
            <select
              id="report-account"
              value={accountId ?? ''}
              onChange={(e) => {
                const v = e.target.value
                router.push(href(month, v === '' ? null : Number(v)))
              }}
              className="h-8 rounded-lg border border-[--border] bg-[--surface-2] px-2.5 text-sm text-[--ink] focus:outline-none focus:ring-2 focus:ring-[--ring]"
            >
              <option value="">Tutti i conti</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </>
        )
      )}
    </div>
  )
}

function pillClass(active: boolean): string {
  return [
    'px-3 py-1.5 rounded-lg text-sm transition-all duration-150 whitespace-nowrap',
    active
      ? 'bg-[--brand] text-[--brand-fg] font-medium shadow-sm'
      : 'text-[--muted] hover:text-[--ink]',
  ].join(' ')
}
