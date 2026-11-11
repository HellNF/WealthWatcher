'use client'

// Navigazione del Report: stepper ‹ mese › + select per salti lontani.
// Scala a qualsiasi profondità di storico senza esplodere in righe di pill.
// Le frecce ← → della tastiera cambiano mese (senza animazioni: è un'azione
// ripetuta, deve essere istantanea).
import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Select } from '@/components/ui/Select'
import { useSlidingPill } from '@/components/ui/useSlidingPill'

interface AccountOption { id: number; name: string }

interface Props {
  months:    string[]          // YYYY-MM, dal più recente
  month:     string            // mese selezionato
  accounts:  AccountOption[]
  accountId: number | null
  /** Solo lo stepper ‹ mese ›, per la barra compatta in alto */
  compact?:  boolean
  /** Pagina su cui navigare (default: Report) */
  basePath?: string
}

const MONTH_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function label(m: string): string {
  return `${MONTH_SHORT[Number(m.slice(5, 7)) - 1] ?? m} ${m.slice(0, 4)}`
}

type HrefFn = (month: string, accountId: number | null) => string

function makeHref(basePath: string): HrefFn {
  return (month, accountId) => {
    const params = new URLSearchParams({ month })
    if (accountId !== null) params.set('account', String(accountId))
    return `${basePath}?${params.toString()}`
  }
}

const CONTROL = 'h-8 pointer-coarse:h-10 rounded-lg border border-(--border) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)'

function Step({ target, accountId, dir, href }: { target: string | null; accountId: number | null; dir: 'prev' | 'next'; href: HrefFn }) {
  const Icon = dir === 'prev' ? ChevronLeft : ChevronRight
  const base = cn(CONTROL, 'flex w-8 pointer-coarse:w-10 items-center justify-center')
  if (!target) {
    return <span className={cn(base, 'text-(--faint) opacity-40')} aria-hidden><Icon className="size-4" strokeWidth={1.75} /></span>
  }
  return (
    <Link
      href={href(target, accountId)}
      scroll={false}
      aria-label={`${dir === 'prev' ? 'Mese precedente' : 'Mese successivo'}, ${label(target)}`}
      aria-keyshortcuts={dir === 'prev' ? 'ArrowLeft' : 'ArrowRight'}
      className={cn(
        base,
        'text-(--muted) hover:text-(--ink) hover:bg-(--surface-2) active:scale-[0.94] active:bg-(--surface-2)',
        'transition-[transform,scale,translate,color,background-color] duration-150 ease-out-strong',
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </Link>
  )
}

export default function MonthNav({ months, month, accounts, accountId, compact, basePath = '/dashboard/reports' }: Props) {
  const router = useRouter()
  const href = useMemo(() => makeHref(basePath), [basePath])

  const idx  = months.indexOf(month)
  // months è ordinato dal più recente: "precedente" = indice successivo
  const prev = idx >= 0 && idx < months.length - 1 ? months[idx + 1] : null
  const next = idx > 0 ? months[idx - 1] : null

  // ← → cambiano mese. Solo l'istanza principale ascolta, e mai mentre si scrive in un campo.
  useEffect(() => {
    if (compact) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName))) return
      const target = e.key === 'ArrowLeft' ? prev : e.key === 'ArrowRight' ? next : null
      if (!target) return
      e.preventDefault()
      router.push(href(target, accountId), { scroll: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [compact, prev, next, accountId, router, href])

  if (compact) {
    return (
      <nav aria-label="Mese" className="flex items-center gap-1.5">
        <Step target={prev} accountId={accountId} dir="prev" href={href} />
        <Step target={next} accountId={accountId} dir="next" href={href} />
      </nav>
    )
  }

  const accountOptions = [{ id: null as number | null, name: 'Tutti i conti' }, ...accounts]

  return (
    <div className="flex items-center gap-3 flex-wrap min-w-0 max-w-full">
      <nav aria-label="Mese" className="flex items-center gap-1.5">
        <Step target={prev} accountId={accountId} dir="prev" href={href} />

        <label className="sr-only" htmlFor="month-select">Mese</label>
        <Select
          id="month-select"
          value={month}
          onValueChange={(v) => router.push(href(v, accountId), { scroll: false })}
          className="h-8 pointer-coarse:h-10 w-auto px-2.5 font-medium tabular-nums privacy-keep"
          options={months.map((m) => ({ value: m, label: label(m) }))}
        />

        <Step target={next} accountId={accountId} dir="next" href={href} />
      </nav>

      {accounts.length > 1 && (
        accounts.length <= 3 ? (
          <AccountPills options={accountOptions} accountId={accountId} month={month} href={href} />
        ) : (
          <>
            <label className="sr-only" htmlFor="report-account">Conto</label>
            <Select
              id="report-account"
              value={accountId === null ? '' : String(accountId)}
              onValueChange={(v) => router.push(href(month, v === '' ? null : Number(v)), { scroll: false })}
              className="h-8 pointer-coarse:h-10 w-auto max-w-64 px-2.5"
              options={[{ value: '', label: 'Tutti i conti' }, ...accounts.map((acc) => ({ value: String(acc.id), label: acc.name }))]}
            />
          </>
        )
      )}
    </div>
  )
}

/** Filtro conto a segmenti (fino a 3 conti): pillola che scivola in CSS, anche durante la navigazione. */
function AccountPills({ options, accountId, month, href }: {
  options: { id: number | null; name: string }[]
  accountId: number | null
  month: string
  href: HrefFn
}) {
  const { containerRef, pillRef } = useSlidingPill<HTMLElement>(String(accountId ?? 'all'))
  return (
    <nav ref={containerRef} aria-label="Filtro conto" className="relative flex gap-0.5 flex-wrap p-0.5 bg-(--surface-2) rounded-lg min-w-0 max-w-full">
      <span ref={pillRef} aria-hidden className="pointer-events-none absolute left-0 top-0 origin-top-left rounded-md bg-(--surface) shadow-(--shadow-sm) ring-1 ring-(--border) opacity-0" />
      {options.map((acc) => {
        const active = accountId === acc.id
        return (
          <Link
            key={acc.id ?? 'all'}
            data-pill-key={String(acc.id ?? 'all')}
            href={href(month, acc.id)}
            scroll={false}
            aria-current={active ? 'true' : undefined}
            title={acc.name}
            className={cn(
              'relative h-7 pointer-coarse:h-9 px-3 flex items-center rounded-md text-sm whitespace-nowrap select-none min-w-0 max-w-full',
              'transition-[color,scale] duration-150 ease-out-strong active:scale-[0.97]',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--ring)',
              active ? 'text-(--ink) font-medium' : 'text-(--muted) hover:text-(--ink)',
            )}
          >
            <span className="relative truncate max-w-[16rem]">{acc.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
