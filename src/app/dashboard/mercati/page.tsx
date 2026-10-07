// src/app/dashboard/mercati/page.tsx — "Panorama Mercati". Pensata per chi non
// segue i mercati tutti i giorni: dall'alto verso il basso si passa dalla
// risposta in dieci secondi al dettaglio.
//
//   1. In sintesi            — una riga per classe di investimento
//   2. Cosa sta succedendo   — quadro macro (inflazione, tassi, crescita, …)
//   3. Come si muovono       — rendimenti dei mercati e dei settori
//   4. È un buon momento?    — valutazioni di settore argomentate
//   5. Cosa dice la storia   — frequenze storiche (dataset Shiller)
//   6. Il tuo portafoglio    — composizione e incrocio col contesto
//
// Tutto è letto dalla cache popolata da `npm run market-refresh` (o dal pulsante
// "Aggiorna i dati"): nessun fetch esterno nel render. Tono: descrizione
// oggettiva del contesto, mai raccomandazione personalizzata.
import { requireUser } from '@/lib/dal'
import { Card, Badge, EmptyState, Eyebrow, HeroShell, PageHeader, SectionNav, StickyBar, PAGE_SHELL } from '@/components/ui'
import { Info, PieChart, Sparkles, Gauge, Globe, TrendingUp, History, TriangleAlert } from 'lucide-react'
import { getPortfolioAllocation } from '@/lib/marketOverview/allocation'
import { readSignals, readAnalyses, readBlob, readStanceHistory, type CachedSignal } from '@/lib/marketOverview/cache'
import { buildCrossInsights } from '@/lib/marketOverview/crossref'
import { readRefreshReport } from '@/lib/marketOverview/refresh'
import type { MacroOverview } from '@/lib/marketOverview/macro'
import type { PerformanceBoard } from '@/lib/marketOverview/performance'
import type { StoredEquityEvidence } from '@/lib/marketOverview/evidence'
import { computeExposure, type Lookthrough } from '@/lib/marketOverview/lookthrough'
import { AllocationBar, ExposureBar } from './AllocationBar'
import { SectorPanel } from './SectorPanel'
import { SummaryTiles, summaryVerdict } from './SummaryBlock'
import { MacroSection } from './MacroSection'
import { PerformanceTable } from './PerformanceTable'
import { EvidenceSection } from './EvidenceSection'
import RefreshMarketsButton from './RefreshMarketsButton'
import { fmtEpochDate } from './format'

export const dynamic = 'force-dynamic'
// Il pulsante "Aggiorna i dati" interroga una ventina di fonti esterne (~1 minuto).
export const maxDuration = 180

// Ordine di presentazione dei settori + prefisso dei segnali di supporto.
const SECTOR_ORDER: { key: string; prefix: string }[] = [
  { key: 'equities',    prefix: 'equities.' },
  { key: 'bonds',       prefix: 'bonds.' },
  { key: 'commodities', prefix: 'commodities.' },
  { key: 'crypto',      prefix: 'crypto.' },
]

// Oltre questa età i dati sono segnalati come non aggiornati (il job è giornaliero).
const STALE_AFTER_S = 3 * 86400

const NAV = [
  { id: 'sintesi',     label: 'In sintesi' },
  { id: 'mondo',       label: 'Economia' },
  { id: 'andamento',   label: 'Andamento' },
  { id: 'valutazioni', label: 'Valutazioni' },
  { id: 'storia',      label: 'Storia' },
  { id: 'portafoglio', label: 'Il tuo portafoglio' },
]

function SectionTitle({ icon: Icon, children, aside }: { icon: typeof Info; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <Icon className="size-5 text-(--muted)" strokeWidth={1.75} aria-hidden />
        <h2 className="text-lg font-semibold text-(--ink)">{children}</h2>
      </div>
      {aside}
    </div>
  )
}

function Pending({ what }: { what: string }) {
  return (
    <Card>
      <p className="text-sm text-(--muted)">
        {what} non ancora disponibili: vengono calcolati dall’aggiornamento periodico. Puoi avviarlo ora con «Aggiorna i dati» in cima alla pagina.
      </p>
    </Card>
  )
}

export default async function MercatiPage() {
  const user = await requireUser()
  const nowDate = new Date()
  const now = Math.floor(nowDate.getTime() / 1000)
  const today = nowDate.toISOString().slice(0, 10)

  const allocation = await getPortfolioAllocation(user.id, today)
  const signals    = readSignals()
  const analyses   = readAnalyses()
  const history    = readStanceHistory()
  const macro      = readBlob<MacroOverview>('macro')?.value ?? null
  const perf       = readBlob<PerformanceBoard>('performance')?.value ?? null
  const evidence   = readBlob<StoredEquityEvidence>('evidence')?.value ?? null
  const report     = readRefreshReport()
  const exposure   = computeExposure(allocation.positions, readBlob<Lookthrough>('lookthrough')?.value ?? {})
  const insights   = buildCrossInsights(allocation, analyses, exposure)

  const signalsFor = (prefix: string): CachedSignal[] => signals.filter((s) => s.code.startsWith(prefix))
  const orderedPanels = SECTOR_ORDER
    .map(({ key, prefix }) => ({ analysis: analyses.find((a) => a.key === key), signals: signalsFor(prefix) }))
    .filter((p): p is { analysis: NonNullable<typeof p.analysis>; signals: CachedSignal[] } => Boolean(p.analysis))

  const lastUpdate = report?.finishedAt ?? (analyses.length ? Math.max(...analyses.map((a) => a.cachedAt)) : null)
  const isStale = lastUpdate !== null && now - lastUpdate > STALE_AFTER_S

  const verdict = orderedPanels.length > 0 ? summaryVerdict(orderedPanels.map((p) => p.analysis)) : null

  return (
    <>
    <StickyBar watchId="mercati-title" interactive>
      <span className="text-sm font-medium text-(--ink) shrink-0">Mercati</span>
      <SectionNav sections={NAV} className="ml-auto" />
    </StickyBar>
    <main className={`${PAGE_SHELL} space-y-14`}>
      <div className="space-y-6">
        <PageHeader
          breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Mercati' }]}
          titleId="mercati-title"
          title="Mercati"
          meta={lastUpdate
            ? <Badge variant={isStale ? 'warning' : 'neutral'}>Dati aggiornati al {fmtEpochDate(lastUpdate, true)}</Badge>
            : <Badge variant="warning">Dati non ancora scaricati</Badge>}
          actions={<><SectionNav sections={NAV} /><RefreshMarketsButton /></>}
        />

        {isStale && (
          <div className="flex items-start gap-2.5 rounded-lg border border-(--border) bg-(--warning-subtle) px-4 py-3">
            <TriangleAlert className="size-4 shrink-0 mt-0.5 text-(--warning-text)" strokeWidth={1.75} aria-hidden />
            <p className="text-xs text-(--warning-text) leading-relaxed">
              Questi dati hanno più di tre giorni: l’aggiornamento automatico non sta girando. Quello che leggi qui sotto
              descrive la situazione del {fmtEpochDate(lastUpdate!, true)}, non quella di oggi. Premi «Aggiorna i dati».
            </p>
          </div>
        )}

        {report && report.failures.length > 0 && !isStale && (
          <p className="text-xs text-(--warning-text)">
            Nell’ultimo aggiornamento alcune fonti non hanno risposto, quindi queste parti mostrano l’ultimo dato valido: {report.failures.join('; ')}.
          </p>
        )}

        {/* ── 1. In sintesi (hero): la risposta in dieci secondi ───────────── */}
        <section id="sintesi" className="scroll-mt-20">
          {orderedPanels.length === 0 || !verdict ? (
            <Pending what="Le valutazioni" />
          ) : (
            <HeroShell>
              <div className="p-6 sm:p-8 space-y-4">
                <Eyebrow>In sintesi</Eyebrow>
                <h2 className="text-2xl sm:text-3xl font-bold font-display leading-tight tracking-[-0.02em] text-(--ink) max-w-[40ch] [text-wrap:balance]">
                  {verdict.headline}
                </h2>
                <p className="text-sm text-(--muted) max-w-[75ch]">
                  {verdict.detail}{' '}
                  La scala va da «Teso» (prezzi alti, poco margine) a «Favorevole» (prezzi storicamente convenienti).
                </p>
              </div>
              <SummaryTiles analyses={orderedPanels.map((p) => p.analysis)} history={history} />
              {/* Disclaimer — obbligatorio: contenuto informativo, non consulenza. */}
              <div className="flex items-start gap-2.5 border-t border-(--border) bg-(--surface) px-6 sm:px-8 py-4">
                <Info className="size-4 shrink-0 mt-0.5 text-(--muted)" strokeWidth={1.75} aria-hidden />
                <p className="text-xs text-(--muted) leading-relaxed max-w-[130ch]">
                  Contenuto <strong className="text-(--ink)">informativo ed educativo</strong>, non una raccomandazione
                  personalizzata di investimento. Ogni valutazione nasce da dati pubblici di fonti ufficiali, confrontati con la
                  loro storia secondo regole fisse e dichiarate: descrive se un mercato è caro o a sconto rispetto al passato,
                  non prevede se salirà o scenderà.
                </p>
              </div>
            </HeroShell>
          )}
        </section>
      </div>

      {/* ── 2. Cosa sta succedendo ─────────────────────────────────────────── */}
      <section id="mondo" className="space-y-4 scroll-mt-20">
        <SectionTitle icon={Globe}>Cosa sta succedendo nell’economia</SectionTitle>
        {macro && macro.themes.length > 0 ? <MacroSection themes={macro.themes} /> : <Pending what="I dati sull’economia" />}
      </section>

      {/* ── 3. Andamento dei mercati ───────────────────────────────────────── */}
      <section id="andamento" className="space-y-4 scroll-mt-20">
        <SectionTitle icon={TrendingUp}>Come si stanno muovendo i mercati</SectionTitle>
        {perf && perf.rows.length > 0 ? <PerformanceTable rows={perf.rows} /> : <Pending what="Gli andamenti dei mercati" />}
      </section>

      {/* ── 4. Valutazioni di settore ──────────────────────────────────────── */}
      <section id="valutazioni" className="space-y-6 scroll-mt-20">
        <SectionTitle icon={Gauge}>È un buon momento? Le valutazioni, una per una</SectionTitle>
        <p className="text-sm text-(--muted) leading-relaxed max-w-[75ch]">
          Ogni valutazione è la media pesata di più indicatori, ciascuno confrontato con la propria storia. Sotto ogni
          indicatore trovi cosa misura e da dove viene il dato. «Favorevole» significa che in passato, partendo da
          condizioni simili, i risultati sono stati migliori della media — non che i prezzi saliranno.
        </p>

        {orderedPanels.length === 0 ? (
          <Pending what="Le valutazioni" />
        ) : (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 2xl:items-stretch [&>*:last-child:nth-child(odd)]:2xl:col-span-2">
            {orderedPanels.map((p) => (
              <SectorPanel key={p.analysis.key} analysis={p.analysis} signals={p.signals} />
            ))}
          </div>
        )}
      </section>

      {/* ── 5. Cosa dice la storia ─────────────────────────────────────────── */}
      <section id="storia" className="space-y-4 scroll-mt-20">
        <SectionTitle icon={History}>Cosa dice la storia</SectionTitle>
        {evidence ? <EvidenceSection evidence={evidence} /> : <Pending what="Le statistiche storiche" />}
      </section>

      {/* ── 6. Il tuo portafoglio ──────────────────────────────────────────── */}
      <section id="portafoglio" className="space-y-4 scroll-mt-20">
        <SectionTitle icon={PieChart}>Il tuo portafoglio in questo contesto</SectionTitle>
        {allocation.byCluster.length === 0 ? (
          <EmptyState
            title="Nessun investimento da mostrare"
            description="Aggiungi strumenti a un portafoglio per vedere qui la ripartizione per classe di asset."
          />
        ) : (
          <Card className="space-y-6">
            <AllocationBar allocation={allocation} />
            {exposure.hasLookthrough && (
              <div className="border-t border-(--border) pt-5">
                <ExposureBar exposure={exposure} />
              </div>
            )}
          </Card>
        )}

        {insights.length > 0 && (
          <div className="flex flex-wrap gap-4">
            {insights.map((ins) => (
              <Card key={ins.id} className="flex-1 basis-[30rem] flex items-start gap-3">
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                    ins.tone === 'attention' ? 'bg-(--surface-2) text-(--warning-text)' : 'bg-(--surface-2) text-(--muted)'
                  }`}
                >
                  <Sparkles className="size-4" strokeWidth={1.75} aria-hidden />
                </span>
                <p className="text-sm text-(--muted) leading-relaxed">{ins.text}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── Metodo ─────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <details className="rounded-2xl border border-(--border) bg-(--surface) px-4 sm:px-5 py-4">
          <summary className="cursor-pointer text-sm font-semibold text-(--ink) select-none">Come nascono queste valutazioni, e cosa non possono dirti</summary>
          <div className="pt-3 space-y-2 text-sm text-(--muted) leading-relaxed max-w-[75ch]">
            <p>
              <strong className="text-(--ink)">Le fonti.</strong> Inflazione da Eurostat; tassi, rendimenti dei titoli di
              Stato, PIL, disoccupazione e cambio dalla Banca Centrale Europea; dati americani dalla Federal Reserve
              (archivio FRED); valutazioni storiche della borsa dal dataset del prof. Robert Shiller (Yale); prezzi di
              indici, materie prime e Bitcoin da Yahoo Finance; umore del mercato crypto da alternative.me e CoinGecko.
            </p>
            <p>
              <strong className="text-(--ink)">Il calcolo.</strong> Ogni indicatore viene trasformato in un punteggio tra
              −1 e +1 con una regola fissa (ad esempio: più il prezzo è alto rispetto agli ultimi 10 anni, più il punteggio
              è negativo). I punteggi vengono mediati con pesi dichiarati. Non c’è nessun modello opaco né alcuna opinione:
              gli stessi dati producono sempre la stessa valutazione. Se un dato manca, l’indicatore viene escluso e la
              «confidenza» scende.
            </p>
            <p>
              <strong className="text-(--ink)">I limiti.</strong> Un mercato caro può restare caro, o diventarlo di più, per
              anni: le valutazioni dicono qualcosa sui rendimenti a 10 anni, quasi nulla su quelli a 12 mesi. Queste
              letture non conoscono i tuoi obiettivi, il tuo orizzonte né la tua situazione fiscale, e non sostituiscono
              un consulente abilitato.
            </p>
          </div>
        </details>
      </section>
    </main>
    </>
  )
}
