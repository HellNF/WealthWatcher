// src/app/dashboard/mercati/page.tsx — "Panorama Mercati": composizione del
// portafoglio (Blocco 1) + incrocio col portafoglio (Blocco 3) + analisi di
// settore argomentate (Blocco 2), tutte lette dalla cache popolata dal job
// `npm run market-refresh`. Tono: valutazione generale di contesto, mai
// raccomandazione personalizzata.
import { requireUser } from '@/lib/dal'
import { Breadcrumb, Card, Badge, EmptyState } from '@/components/ui'
import { Info, PieChart, Sparkles, Gauge } from 'lucide-react'
import { getPortfolioAllocation } from '@/lib/marketOverview/allocation'
import { readSignals, readAnalyses, type CachedSignal } from '@/lib/marketOverview/cache'
import { buildCrossInsights } from '@/lib/marketOverview/crossref'
import { AllocationBar } from './AllocationBar'
import { SectorPanel } from './SectorPanel'

export const dynamic = 'force-dynamic'

// Ordine di presentazione dei settori + prefisso dei segnali di supporto.
const SECTOR_ORDER: { key: string; prefix: string }[] = [
  { key: 'equities',    prefix: 'equities.' },
  { key: 'bonds',       prefix: 'bonds.' },
  { key: 'commodities', prefix: 'commodities.' },
  { key: 'crypto',      prefix: 'crypto.' },
]

export default async function MercatiPage() {
  const user = await requireUser()
  const today = new Date().toISOString().slice(0, 10)

  const allocation = await getPortfolioAllocation(user.id, today)
  const signals    = readSignals()
  const analyses   = readAnalyses()
  const insights   = buildCrossInsights(allocation, analyses)

  const signalsFor = (prefix: string): CachedSignal[] => signals.filter((s) => s.code.startsWith(prefix))
  const orderedPanels = SECTOR_ORDER
    .map(({ key, prefix }) => ({ analysis: analyses.find((a) => a.key === key), signals: signalsFor(prefix) }))
    .filter((p): p is { analysis: NonNullable<typeof p.analysis>; signals: CachedSignal[] } => Boolean(p.analysis))

  const lastUpdate = analyses.length
    ? new Date(Math.max(...analyses.map((a) => a.cachedAt)) * 1000).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : null

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-12">
      <Breadcrumb items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Mercati' }]} />

      {/* Disclaimer — obbligatorio: contenuto informativo, non consulenza. */}
      <div className="flex items-start gap-2.5 rounded-lg border border-[--border] bg-[--surface-2] px-4 py-3">
        <Info className="size-4 shrink-0 mt-0.5 text-[--muted]" strokeWidth={1.75} aria-hidden />
        <p className="text-xs text-[--muted] leading-relaxed">
          Contenuto puramente <strong className="text-[--ink]">informativo ed educativo</strong>, non una
          raccomandazione personalizzata di investimento. Ogni valutazione di settore nasce dall&apos;incrocio di
          più indicatori oggettivi con le loro fonti: serve a inquadrare il contesto e a orientare gli
          approfondimenti, non a dire cosa comprare o vendere.
        </p>
      </div>

      {/* ── Blocco 1: composizione del portafoglio ─────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <PieChart className="size-5 text-[--brand-text]" strokeWidth={1.75} />
          <h2 className="text-lg font-semibold text-[--ink]">La tua composizione</h2>
        </div>
        {allocation.byCluster.length === 0 ? (
          <EmptyState
            title="Nessun investimento da mostrare"
            description="Aggiungi strumenti a un portafoglio per vedere qui la ripartizione per classe di asset."
          />
        ) : (
          <Card>
            <AllocationBar allocation={allocation} />
          </Card>
        )}
      </section>

      {/* ── Blocco 3: incrocio portafoglio × contesto ──────────────────────── */}
      {insights.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-[--brand-text]" strokeWidth={1.75} />
            <h2 className="text-lg font-semibold text-[--ink]">Il tuo portafoglio nel contesto attuale</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((ins) => (
              <Card key={ins.id} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                    ins.tone === 'attention' ? 'bg-[--warning-subtle] text-[--warning-text]' : 'bg-[--surface-2] text-[--muted]'
                  }`}
                >
                  <Info className="size-4" strokeWidth={1.75} aria-hidden />
                </span>
                <p className="text-sm text-[--muted] leading-relaxed">{ins.text}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── Blocco 2: analisi di settore ───────────────────────────────────── */}
      <section className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Gauge className="size-5 text-[--brand-text]" strokeWidth={1.75} />
            <h2 className="text-lg font-semibold text-[--ink]">Analisi dei mercati per settore</h2>
          </div>
          {lastUpdate && <Badge variant="neutral">Aggiornato al {lastUpdate}</Badge>}
        </div>

        {orderedPanels.length === 0 ? (
          <Card>
            <p className="text-sm text-[--muted]">
              Analisi non ancora disponibili. Vengono generate periodicamente in background
              (<code className="text-xs">npm run market-refresh</code>).
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {orderedPanels.map((p) => (
              <SectorPanel key={p.analysis.key} analysis={p.analysis} signals={p.signals} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
