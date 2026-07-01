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
import RenameForm from '@/components/dashboard/RenameForm'
import { renamePortfolioAction, deletePortfolioAction } from './actions'
import { Breadcrumb, Card, Stat, Badge, ConfirmDelete } from '@/components/ui'

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

  const rawTxns = listTxns(user.id, id)
  const txnsWithSymbol = rawTxns.map((t) => {
    const instr = getInstrument(t.instrument_id)
    return { ...t, symbol: instr?.symbol ?? '?', instrument_name: instr?.name ?? '' }
  })

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        ...(institution
          ? [{ label: institution.name, href: `/dashboard/institutions/${institution.id}` }]
          : []),
        { label: portfolio.name },
      ]} />

      {/* ── Sommario per valuta ──────────────────────────────────────────── */}
      {summary.byCurrency.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.byCurrency.map((cur) => {
            const pl = cur.totalUnrealizedPlMinor
            const eurEquiv = cur.currency !== 'EUR'
              ? eurEquivalents.get(cur.currency)
              : null

            return (
              <Card key={cur.currency} className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[--muted]">{cur.currency}</span>
                  {pl !== null && (
                    <Badge variant={pl >= 0 ? 'gain' : 'loss'}>
                      P/L {pl >= 0 ? '+' : ''}{fromMinor(pl, cur.currency)}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Stat
                    label="Investito"
                    value={fromMinor(cur.totalCostMinor, cur.currency)}
                    size="sm"
                  />
                  <Stat
                    label="Valore att."
                    value={cur.totalMarketMinor !== null
                      ? fromMinor(cur.totalMarketMinor, cur.currency)
                      : '—'}
                    size="sm"
                    sub={eurEquiv != null ? `≈ ${fromMinor(eurEquiv, 'EUR')}` : undefined}
                  />
                </div>

                {cur.totalRealizedPlMinor !== 0 && (
                  <Stat
                    label="P/L realizzato"
                    value={`${cur.totalRealizedPlMinor >= 0 ? '+' : ''}${fromMinor(cur.totalRealizedPlMinor, cur.currency)}`}
                    size="sm"
                  />
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Posizioni ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[--ink]">Posizioni</h2>
        <PositionsTable positions={positions} portfolioId={id} />
      </section>

      {/* ── Operazioni ──────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-[--ink]">Operazioni</h2>
        <AddTxnForm portfolioId={id} />
        <TxnList txns={txnsWithSymbol} portfolioId={id} />
      </section>

      {/* ── Gestione portafoglio ────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[--ink]">Gestione portafoglio</h2>
        <Card className="flex items-center justify-between gap-4 flex-wrap">
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
        </Card>
      </section>
    </main>
  )
}
