import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getMortgage, amortizationSchedule, mortgageStatus, monthlyPaymentMinor } from '@/lib/mortgages'
import { fromMinor } from '@/lib/money'
import { sqlite } from '@/db'
import {
  Breadcrumb, Card, Stat, Badge,
  TableWrapper, Table, TableHead, TableBody, Th, Tr, Td,
  DataCard, DataCardHeader, DataRow,
} from '@/components/ui'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

function fmtEur(minor: number) {
  return fromMinor(minor, 'EUR')
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default async function MortgageDetailPage({ params }: Props) {
  const { id: idStr } = await params
  const id   = parseInt(idStr, 10)
  if (isNaN(id)) notFound()

  const user     = await requireUser()
  const mortgage = getMortgage(user.id, id)
  if (!mortgage) notFound()

  const today    = new Date().toISOString().slice(0, 10)
  const schedule = amortizationSchedule(mortgage)
  const status   = mortgageStatus(mortgage, today)
  const R        = monthlyPaymentMinor(mortgage.initial_capital_minor, mortgage.annual_interest_rate, mortgage.duration_months)
  const rateDisplay = (parseFloat(mortgage.annual_interest_rate) * 100).toFixed(3).replace(/\.?0+$/, '').replace('.', ',')

  // Riconciliazione transazioni (solo se associated_account_id impostato)
  type TxnRow = { booked_date: string; amount_minor: number; description_raw: string }
  const mutuoTxns: TxnRow[] = mortgage.associated_account_id
    ? sqlite.prepare(`
        SELECT t.booked_date, t.amount_minor, t.description_raw
        FROM transactions t
        JOIN categories c ON c.id = t.category_id
        WHERE t.bank_account_id = ?
          AND c.name = 'Mutuo'
          AND t.owner_id = ?
        ORDER BY t.booked_date DESC
        LIMIT 24
      `).all(mortgage.associated_account_id, user.id) as TxnRow[]
    : []

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Mutui', href: '/dashboard/mutui' },
        { label: mortgage.name },
      ]} />

      {/* Riepilogo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Rata mensile"     value={fmtEur(R)}                            />
        <Stat label="Capitale residuo" value={fmtEur(status.remainingCapitalMinor)} />
        <Stat label="Quota interessi"  value={fmtEur(status.currentRateInterest)}   sub="rata corrente" />
        <Stat label="Quota capitale"   value={fmtEur(status.currentRatePrincipal)}  sub="rata corrente" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Capitale iniziale" value={fmtEur(mortgage.initial_capital_minor)} />
        <Stat label="Tasso annuo"       value={`${rateDisplay}%`} />
        <Stat label="Durata"            value={`${mortgage.duration_months} mesi`} />
        <Stat label="Prima rata"        value={fmtDate(mortgage.start_date)} />
      </div>

      {/* Piano ammortamento — Desktop */}
      <Card className="overflow-hidden">
        <h2 className="text-sm font-semibold text-[--ink] px-4 pt-4 pb-3">Piano di ammortamento</h2>

        <div className="hidden sm:block">
          <TableWrapper>
            <Table>
              <TableHead>
                <Tr>
                  <Th>#</Th>
                  <Th>Data</Th>
                  <Th align="right">Rata</Th>
                  <Th align="right">Interessi</Th>
                  <Th align="right">Capitale</Th>
                  <Th align="right">Residuo</Th>
                </Tr>
              </TableHead>
              <TableBody>
                {schedule.map((row) => {
                  const isCurrent = row.date >= today && (schedule[row.monthIndex - 2]?.date ?? '') < today
                  return (
                    <Tr key={row.monthIndex} className={isCurrent ? 'bg-[--brand-subtle]' : ''}>
                      <Td className="text-[--muted] tabular-nums">{row.monthIndex}</Td>
                      <Td className="tabular-nums">{fmtDate(row.date)}</Td>
                      <Td align="right" className="tabular-nums">{fmtEur(row.paymentMinor)}</Td>
                      <Td align="right" className="tabular-nums text-[--danger]">{fmtEur(row.interestMinor)}</Td>
                      <Td align="right" className="tabular-nums text-[--brand-text]">{fmtEur(row.principalMinor)}</Td>
                      <Td align="right" className="tabular-nums font-medium">{fmtEur(row.remainingCapitalMinor)}</Td>
                    </Tr>
                  )
                })}
              </TableBody>
            </Table>
          </TableWrapper>
        </div>

        {/* Mobile */}
        <div className="sm:hidden divide-y divide-[--border]">
          {schedule.map((row) => {
            const isCurrent = row.date >= today && (schedule[row.monthIndex - 2]?.date ?? '') < today
            return (
              <DataCard key={row.monthIndex} className={isCurrent ? 'bg-[--brand-subtle]' : ''}>
                <DataCardHeader
                  title={`Rata ${row.monthIndex} — ${fmtDate(row.date)}`}
                  subtitle={fmtEur(row.paymentMinor)}
                />
                <DataRow label="Interessi">{fmtEur(row.interestMinor)}</DataRow>
                <DataRow label="Capitale">{fmtEur(row.principalMinor)}</DataRow>
                <DataRow label="Residuo">{fmtEur(row.remainingCapitalMinor)}</DataRow>
              </DataCard>
            )
          })}
        </div>
      </Card>

      {/* Riconciliazione transazioni */}
      {mutuoTxns.length > 0 && (
        <Card className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-[--ink]">Rate rilevate sul conto</h2>
            <p className="text-xs text-[--muted] mt-0.5">
              Transazioni categorizzate come "Mutuo" sul conto associato. Lo split interessi/capitale è calcolato teoricamente in base al piano di ammortamento.
            </p>
          </div>
          <div className="hidden sm:block">
            <TableWrapper>
              <Table>
                <TableHead>
                  <Tr>
                    <Th>Data</Th>
                    <Th>Descrizione</Th>
                    <Th align="right">Importo</Th>
                    <Th align="right">Interessi (teor.)</Th>
                    <Th align="right">Capitale (teor.)</Th>
                  </Tr>
                </TableHead>
                <TableBody>
                  {mutuoTxns.map((t, i) => {
                    const schedRow = schedule.find(r => r.date.slice(0, 7) === t.booked_date.slice(0, 7))
                    return (
                      <Tr key={i}>
                        <Td className="tabular-nums">{fmtDate(t.booked_date)}</Td>
                        <Td className="text-[--muted] truncate max-w-[200px]">{t.description_raw}</Td>
                        <Td align="right" className="tabular-nums">{fmtEur(Math.abs(t.amount_minor))}</Td>
                        <Td align="right" className="tabular-nums text-[--danger]">{schedRow ? fmtEur(schedRow.interestMinor) : '—'}</Td>
                        <Td align="right" className="tabular-nums text-[--brand-text]">{schedRow ? fmtEur(schedRow.principalMinor) : '—'}</Td>
                      </Tr>
                    )
                  })}
                </TableBody>
              </Table>
            </TableWrapper>
          </div>
          <div className="sm:hidden divide-y divide-[--border]">
            {mutuoTxns.map((t, i) => {
              const schedRow = schedule.find(r => r.date.slice(0, 7) === t.booked_date.slice(0, 7))
              return (
                <DataCard key={i}>
                  <DataCardHeader title={fmtDate(t.booked_date)} subtitle={fmtEur(Math.abs(t.amount_minor))} />
                  <DataRow label="Interessi (teor.)">{schedRow ? fmtEur(schedRow.interestMinor) : '—'}</DataRow>
                  <DataRow label="Capitale (teor.)">{schedRow ? fmtEur(schedRow.principalMinor) : '—'}</DataRow>
                </DataCard>
              )
            })}
          </div>
        </Card>
      )}
    </main>
  )
}
