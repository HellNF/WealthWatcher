import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getPortfolioForUser } from '@/lib/portfolios'
import { getInstitutionForUser } from '@/lib/institutions'
import { listTxns } from '@/lib/investmentTxns'
import { getPortfolioPositions } from '@/lib/positions'
import { refreshPortfolioPrices } from '@/lib/prices'
import { getInstrument } from '@/lib/instruments'
import { formatMoney } from '@/lib/money'
import { convertToEur } from '@/lib/fx/convert'
import PositionsTable from './PositionsTable'
import TxnList from './TxnList'
import AddTxnForm, { type KnownInstrument } from './AddTxnForm'
import HoldingsManager from './HoldingsManager'
import AllocationChart from './AllocationChart'
import InstrumentPriceChart from './InstrumentPriceChart'
import RenameForm from '@/components/dashboard/RenameForm'
import { renamePortfolioAction, deletePortfolioAction } from './actions'
import { Card, Badge, ConfirmDelete, PageHeader, HeroShell, Eyebrow, StickyBar, PAGE_SHELL } from '@/components/ui'
import { AddSection } from '@/components/dashboard/AddSection'
import PriceHistoryBackfillButton from './PriceHistoryBackfillButton'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PortfolioPage({ params }: Props) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) notFound()

  const user = await requireUser()
  const portfolio = getPortfolioForUser(user.id, id)
  if (!portfolio) notFound()

  const institution = getInstitutionForUser(user.id, portfolio.institution_id)

  await refreshPortfolioPrices(user.id, id)

  const { positions, summary } = getPortfolioPositions(user.id, id)

  const today = new Date().toISOString().slice(0, 10)
  const eurEquivalents = new Map<string, number | null>()
  for (const cur of summary.byCurrency) {
    if (cur.currency !== 'EUR' && cur.totalMarketMinor !== null) {
      eurEquivalents.set(
        cur.currency,
        await convertToEur(cur.totalMarketMinor, cur.currency, today),
      )
    }
  }

  const isHoldings = portfolio.mode === 'holdings'

  // In transactions mode, list all txns with symbol for the operations log.
  const txnsWithSymbol = !isHoldings
    ? listTxns(user.id, id).map((t) => {
        const instr = getInstrument(t.instrument_id)
        return { ...t, symbol: instr?.symbol ?? '?', instrument_name: instr?.name ?? '' }
      })
    : []

  // Strumenti attivi nel portafoglio — usati come suggerimento veloce in AddTxnForm.
  const knownInstruments: KnownInstrument[] = !isHoldings
    ? positions
        .filter(p => parseFloat(p.remainingQty) > 0)
        .map(p => {
          const instr = getInstrument(p.instrumentId)
          return {
            instrumentId: p.instrumentId,
            symbol:       p.symbol,
            name:         p.name,
            isin:         instr?.isin ?? null,
            cluster:      instr?.cluster ?? 'other',
            priceSource:  instr?.price_source ?? 'yahoo',
          }
        })
    : []

  const openPositions = positions.filter(p => parseFloat(p.remainingQty) > 0)

  // ── Sintesi dell'hero: valore complessivo in euro ──────────────────────────
  const single     = summary.byCurrency.length === 1 ? summary.byCurrency[0] : null
  let totalEurMinor: number | null = summary.byCurrency.length > 0 ? 0 : null
  for (const cur of summary.byCurrency) {
    const eur = cur.currency === 'EUR' ? cur.totalMarketMinor : eurEquivalents.get(cur.currency) ?? null
    if (eur === null || totalEurMinor === null) { totalEurMinor = null; break }
    totalEurMinor += eur
  }
  const heroValue = single
    ? (single.totalMarketMinor !== null ? formatMoney(single.totalMarketMinor, single.currency) : '—')
    : (totalEurMinor !== null ? formatMoney(totalEurMinor, 'EUR') : '—')
  const heroPl    = single?.totalUnrealizedPlMinor ?? null
  const heroPlPct = single && heroPl !== null && single.totalCostMinor > 0 ? (heroPl / single.totalCostMinor) * 100 : null

  return (
    <>
    <StickyBar watchId="portfolio-value">
      <span className="text-sm font-medium text-(--ink) truncate">{portfolio.name}</span>
      <span className="text-sm text-(--muted)">
        Valore <span className="font-mono tabular-nums font-semibold text-(--ink)">{heroValue}</span>
      </span>
      {heroPl !== null && single && (
        <span className={`ml-auto text-xs font-mono tabular-nums ${heroPl > 0 ? 'text-(--brand-text)' : heroPl < 0 ? 'text-(--danger-text)' : 'text-(--muted)'}`}>
          {heroPl >= 0 ? '+' : ''}{formatMoney(heroPl, single.currency)}
        </span>
      )}
    </StickyBar>
    <main className={`${PAGE_SHELL} space-y-8`}>
      <PageHeader
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          ...(institution
            ? [{ label: institution.name, href: `/dashboard/institutions/${institution.id}` }]
            : []),
          { label: portfolio.name },
        ]}
        title={portfolio.name}
        description={institution ? `Portafoglio d'investimento · ${institution.name}` : "Portafoglio d'investimento"}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:grid-cols-[minmax(0,1fr)_28rem] min-[131rem]:grid-cols-[minmax(0,1fr)_32rem] gap-x-8 2xl:gap-x-10 gap-y-8 items-start">

        {/* ══ Colonna principale: andamento, posizioni, operazioni ══════════ */}
        <div className="order-2 xl:order-1 min-w-0 space-y-8">
          {openPositions.length > 0 && (
            <Card className="space-y-4">
              <h2 className="text-sm font-semibold text-(--ink)">Andamento prezzi</h2>
              <div className="divide-y divide-(--border)">
                {openPositions.map((pos) => (
                  <div key={pos.symbol} className="pt-4 first:pt-0">
                    <InstrumentPriceChart
                      symbol={pos.symbol}
                      name={pos.name}
                      currency={pos.currency}
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {isHoldings ? (
            <HoldingsManager positions={positions} portfolioId={id} />
          ) : (
            <>
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-(--ink)">Posizioni</h2>
                <PositionsTable positions={positions} portfolioId={id} />
              </section>

              <AddSection
                title="Operazioni"
                addLabel="Aggiungi"
                form={<AddTxnForm portfolioId={id} knownInstruments={knownInstruments} />}
              >
                <TxnList txns={txnsWithSymbol} portfolioId={id} />
              </AddSection>
            </>
          )}
        </div>

        {/* ══ Riepilogo: resta in vista mentre scorri la colonna principale ══ */}
        <aside className="order-1 xl:order-2 min-w-0 flex flex-col gap-6 xl:sticky xl:top-16 xl:max-h-[calc(100dvh-5rem)] xl:overflow-y-auto xl:pb-1">
          <HeroShell innerClassName="p-5 sm:p-6 gap-5">
            <div className="space-y-3">
              <Eyebrow>Valore attuale</Eyebrow>
              <p id="portfolio-value" className="text-4xl sm:text-5xl font-extrabold font-display tabular-nums leading-none tracking-[-0.03em] text-(--ink)">
                {heroValue}
              </p>
              {heroPl !== null && single && (
                <p className="flex items-center gap-2 flex-wrap text-sm text-(--muted)">
                  <Badge variant={heroPl >= 0 ? 'gain' : 'loss'} className="font-mono tabular-nums">
                    {heroPl >= 0 ? '+' : ''}{formatMoney(heroPl, single.currency)}
                    {heroPlPct !== null && <> ({heroPl >= 0 ? '+' : ''}{heroPlPct.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%)</>}
                  </Badge>
                  rispetto all&apos;investito
                </p>
              )}
              {!single && summary.byCurrency.length > 1 && (
                <p className="text-xs text-(--muted)">Somma delle valute convertite in euro al cambio di oggi.</p>
              )}
            </div>

            {summary.byCurrency.length > 0 && (
              <dl className="divide-y divide-(--border) border-t border-(--border)">
                {summary.byCurrency.map((cur) => {
                  const pl = cur.totalUnrealizedPlMinor
                  const eurEquiv = cur.currency !== 'EUR' ? eurEquivalents.get(cur.currency) : null
                  return (
                    <div key={cur.currency} className="py-3 last:pb-0 space-y-2">
                      {!single && <dt className="text-xs font-semibold text-(--muted)">{cur.currency}</dt>}
                      <dd className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <span className="text-(--muted)">Investito</span>
                        <span className="text-right font-mono tabular-nums text-(--ink)">{formatMoney(cur.totalCostMinor, cur.currency)}</span>
                        {!single && (
                          <>
                            <span className="text-(--muted)">Valore</span>
                            <span className="text-right font-mono tabular-nums text-(--ink)">
                              {cur.totalMarketMinor !== null ? formatMoney(cur.totalMarketMinor, cur.currency) : '—'}
                              {eurEquiv != null && <span className="block text-xs text-(--muted)">≈ {formatMoney(eurEquiv, 'EUR')}</span>}
                            </span>
                            {pl !== null && (
                              <>
                                <span className="text-(--muted)">P/L non realizzato</span>
                                <span className={`text-right font-mono tabular-nums ${pl > 0 ? 'text-(--brand-text)' : pl < 0 ? 'text-(--danger-text)' : 'text-(--ink)'}`}>
                                  {pl >= 0 ? '+' : ''}{formatMoney(pl, cur.currency)}
                                </span>
                              </>
                            )}
                          </>
                        )}
                        {cur.totalRealizedPlMinor !== 0 && (
                          <>
                            <span className="text-(--muted)">P/L realizzato</span>
                            <span className={`text-right font-mono tabular-nums ${cur.totalRealizedPlMinor > 0 ? 'text-(--brand-text)' : 'text-(--danger-text)'}`}>
                              {cur.totalRealizedPlMinor >= 0 ? '+' : ''}{formatMoney(cur.totalRealizedPlMinor, cur.currency)}
                            </span>
                          </>
                        )}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            )}
          </HeroShell>

          {openPositions.length > 0 && (
            <Card className="space-y-2">
              <h2 className="text-sm font-semibold text-(--ink)">Allocazione</h2>
              <AllocationChart positions={positions} />
            </Card>
          )}

          <Link
            href="/dashboard/tasse"
            className="group flex items-center justify-between gap-4 rounded-2xl border border-(--border) bg-(--surface) px-4 sm:px-5 py-4 hover:bg-(--surface-2) active:bg-(--surface-2) transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ring)"
          >
            <span>
              <span className="block text-sm font-medium text-(--ink)">Analisi fiscale</span>
              <span className="block text-xs text-(--muted) mt-0.5">Zainetto, harvesting, simulatore di vendita.</span>
            </span>
            <ChevronRight className="size-4 text-(--faint) shrink-0 transition-[color,transform] duration-200 ease-out-strong group-hover:text-(--ink) group-hover:translate-x-0.5" aria-hidden />
          </Link>

          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-(--ink)">Gestione portafoglio</h2>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <RenameForm
                action={renamePortfolioAction.bind(null, id)}
                currentName={portfolio.name}
                label="Nome portafoglio"
              />
              <ConfirmDelete
                action={deletePortfolioAction.bind(null, id)}
                label="Elimina portafoglio"
                confirmText="Eliminare il portafoglio e tutte le sue operazioni?"
              />
            </div>
            <div className="border-t border-(--border) pt-4">
              <PriceHistoryBackfillButton portfolioId={id} />
            </div>
          </Card>
        </aside>
      </div>
    </main>
    </>
  )
}
