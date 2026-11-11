'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import NumberFlow from '@number-flow/react'
import { Trash2 } from 'lucide-react'
import { Badge, Button, Card, ConfirmDialog, HeroFigure, Select, Tooltip, toast } from '@/components/ui'
import type { Fixture, FixtureId } from './fixtures'
import { fmtEur } from '@/lib/format'

const STATES: { id: FixtureId; label: string }[] = [
  { id: 'demo', label: 'Demo' },
  { id: 'worst', label: 'Caso peggiore' },
  { id: 'empty', label: 'Vuoto' },
  { id: 'one', label: 'Uno' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-3 min-w-0">
      <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-(--faint)">{title}</h2>
      {children}
    </Card>
  )
}

export default function Playground({ id, fixture: f }: { id: FixtureId; fixture: Fixture }) {
  const params = useSearchParams()
  const openDialog = params.get('dialog') === '1'
  const openTip = params.get('tip') === '1'
  const [i, setI] = useState(0)
  const value = f.netWorth[i % f.netWorth.length]

  useEffect(() => {
    if (params.get('toast') !== '1' || !f.toast) return
    toast.success(f.toast)
    toast.error(f.apiError)
    toast.info('Terza notifica')
  }, [params, f])

  const accountOptions = [{ value: '', label: 'Tutti i conti' }, ...f.accounts.map((a) => ({ value: String(a.id), label: a.name }))]
  const monthOptions = f.months.map((m) => ({ value: m, label: new Date(`${m}-01T12:00:00Z`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) }))
  const categoryGroups = f.categories.map((g) => ({ label: g.group, options: g.items.map((c) => ({ value: String(c.id), label: c.name })) }))

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-28 sm:p-8">
      <h1 className="text-lg font-semibold">Banco di prova componenti · {STATES.find((s) => s.id === id)?.label}</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Select conto (larghezza piena)">
          <Select id="t-account" aria-label="Conto" defaultValue="" options={accountOptions} />
        </Section>

        <Section title="Select conto e mese (w-auto, come nei Report)">
          <div className="flex flex-wrap items-center gap-2">
            <Select id="t-month" aria-label="Mese" defaultValue={f.months[0]} placeholder="Nessun mese" className="h-8 w-auto px-2.5 font-medium tabular-nums privacy-keep" options={monthOptions} />
            <Select id="t-account-auto" aria-label="Conto" defaultValue="" className="h-8 w-auto max-w-64 px-2.5" options={accountOptions} />
          </div>
        </Section>

        <Section title="Select categoria con gruppi (form regole)">
          <div className="min-w-40">
            <Select id="t-category" name="category_id" required placeholder="Scegli…" options={categoryGroups} />
          </div>
        </Section>

        <Section title="Select piccola in una cella stretta (movimenti)">
          <div className="w-40">
            <Select id="t-cell" size="sm" aria-label="Categoria" value={String(f.categories[0]?.items[0]?.id ?? '')}
              options={[{ value: '', label: 'Nessuna' }, ...categoryGroups.flatMap((g) => g.options)]} />
          </div>
        </Section>

        <Section title="Tooltip su badge ed errore API">
          <div className="flex flex-wrap items-center gap-2 text-xs text-(--muted)">
            Auto · stima 11/11/2026
            <Tooltip content={f.apiError || '—'} defaultOpen={openTip}>
              <Badge variant="warning">stale</Badge>
            </Tooltip>
            <Tooltip content={`Rimuovi ${f.email}`}>
              <Button variant="ghost" size="sm" aria-label={`Rimuovi ${f.email}`}><Trash2 className="size-3.5" /></Button>
            </Tooltip>
          </div>
        </Section>

        <Section title="Dialogo di conferma">
          <ConfirmDialog
            defaultOpen={openDialog}
            title={`Eliminare la regola “${f.rulePattern}”?`}
            description="I movimenti già categorizzati restano come sono; i prossimi import non useranno più questa regola."
            onConfirm={() => new Promise((r) => setTimeout(r, 800))}
            trigger={<Button variant="secondary" size="sm">Apri conferma</Button>}
          />
        </Section>

        <Section title="Cifra animata (hero patrimonio)">
          <div className="space-y-3">
            <HeroFigure value={fmtEur(value)} size="xl" className="text-(--ink)">
              <NumberFlow value={value / 100} locales="it-IT"
                format={{ style: 'currency', currency: 'EUR', useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                transformTiming={{ duration: 550, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }}
                spinTiming={{ duration: 550, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }} />
            </HeroFigure>
            <Button id="t-cycle" variant="secondary" size="sm" onClick={() => setI((n) => n + 1)}>Cambia valore</Button>
          </div>
        </Section>

        <Section title="Cifra animata in 320px">
          <div className="w-[min(320px,100%)] rounded-xl border border-dashed border-(--border) p-2">
            <HeroFigure value={fmtEur(value)} size="xl" className="text-(--ink)">
              <NumberFlow value={value / 100} locales="it-IT"
                format={{ style: 'currency', currency: 'EUR', useGrouping: 'always', minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
            </HeroFigure>
          </div>
        </Section>
      </div>

      {/* Selettore dei dati: cromatura di prova, non fa parte del design */}
      <nav aria-label="Dati di prova" className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 gap-0.5 rounded-full bg-neutral-200 p-1 font-[system-ui] text-xs shadow">
        {STATES.map((s) => (
          <Link key={s.id} href={`?data=${s.id}`} replace scroll={false}
            className={s.id === id ? 'whitespace-nowrap rounded-full bg-white px-3 py-1 text-black' : 'whitespace-nowrap rounded-full px-3 py-1 text-neutral-600'}>
            {s.label}
          </Link>
        ))}
      </nav>
    </main>
  )
}
