import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getPortfolioForUser } from '@/lib/portfolios'
import { getInstitutionForUser } from '@/lib/institutions'
import { listTxns } from '@/lib/investmentTxns'
import { getPortfolioPositions } from '@/lib/positions'
import { refreshPortfolioPrices } from '@/lib/prices'
import { getInstrument } from '@/lib/instruments'
import { fromMinor } from '@/lib/money'
import { convertToEur } from '@/lib/fx/convert'
import PositionsTable from './PositionsTable'
import TxnList from './TxnList'
import AddTxnForm from './AddTxnForm'

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

  // Refresh stale prices on page load (TTL lazy — no-op if fresh)
  await refreshPortfolioPrices(user.id, id)

  const { positions, summary } = getPortfolioPositions(user.id, id)

  // EUR equivalents for non-EUR currency buckets (today's rate)
  const today = new Date().toISOString().slice(0, 10)
  const eurEquivalents = new Map<string, number | null>()
  for (const cur of summary.byCurrency) {
    if (cur.currency !== 'EUR' && cur.totalMarketMinor !== null) {
      eurEquivalents.set(cur.currency, await convertToEur(cur.totalMarketMinor, cur.currency, today))
    }
  }

  // Enrich txns with symbol + name for display
  const rawTxns = listTxns(user.id, id)
  const txnsWithSymbol = rawTxns.map((t) => {
    const instr = getInstrument(t.instrument_id)
    return { ...t, symbol: instr?.symbol ?? '?', instrument_name: instr?.name ?? '' }
  })

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-200 transition">
            ← Dashboard
          </Link>
          <span className="text-zinc-700">/</span>
          {institution && (
            <>
              <Link
                href={`/dashboard/institutions/${institution.id}`}
                className="text-zinc-500 hover:text-zinc-200 transition"
              >
                {institution.name}
              </Link>
              <span className="text-zinc-700">/</span>
            </>
          )}
          <span className="font-semibold text-zinc-100">{portfolio.name}</span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 space-y-10">

        {/* Summary per currency */}
        {summary.byCurrency.length > 0 && (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {summary.byCurrency.map((cur) => (
              <div key={cur.currency} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-4 space-y-2">
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">{cur.currency}</p>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Investito</span>
                  <span className="tabular-nums text-zinc-300 font-mono">{fromMinor(cur.totalCostMinor, cur.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Valore att.</span>
                  <div className="text-right">
                    <span className="tabular-nums font-mono text-zinc-200">
                      {cur.totalMarketMinor !== null ? fromMinor(cur.totalMarketMinor, cur.currency) : '—'}
                    </span>
                    {cur.currency !== 'EUR' && cur.totalMarketMinor !== null && (() => {
                      const eur = eurEquivalents.get(cur.currency)
                      return eur != null ? (
                        <span className="block text-xs text-zinc-500 tabular-nums font-mono">
                          ≈ {fromMinor(eur, 'EUR')}
                        </span>
                      ) : null
                    })()}
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">P/L non real.</span>
                  <span className={`tabular-nums font-mono ${
                    cur.totalUnrealizedPlMinor === null ? 'text-zinc-600'
                    : cur.totalUnrealizedPlMinor >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    {cur.totalUnrealizedPlMinor !== null
                      ? `${cur.totalUnrealizedPlMinor >= 0 ? '+' : ''}${fromMinor(cur.totalUnrealizedPlMinor, cur.currency)}`
                      : '—'}
                  </span>
                </div>
                {cur.totalRealizedPlMinor !== 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">P/L real.</span>
                    <span className={`tabular-nums font-mono ${cur.totalRealizedPlMinor >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {cur.totalRealizedPlMinor >= 0 ? '+' : ''}{fromMinor(cur.totalRealizedPlMinor, cur.currency)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Positions */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Posizioni</h2>
          <PositionsTable positions={positions} portfolioId={id} />
        </section>

        {/* Add operation */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Operazioni</h2>
          <AddTxnForm portfolioId={id} />
          <TxnList txns={txnsWithSymbol} portfolioId={id} />
        </section>
      </main>
    </div>
  )
}
