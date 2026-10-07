import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getMortgage, amortizationSchedule, mortgageStatus, monthlyPaymentMinor } from '@/lib/mortgages'
import { formatMoney } from '@/lib/money'
import { sqlite } from '@/db'
import ScrollToCurrent from './ScrollToCurrent'
import {
  Card, Badge, ProgressBar, HeroShell, Eyebrow, StickyBar, PAGE_SHELL,
  TableWrapper, Table, TableHead, TableBody, Th, Tr, Td,
  DataCard, DataCardHeader, DataRow, PageHeader
} from '@/components/ui'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

function fmtEur(minor: number) {
  return formatMoney(minor, 'EUR')
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

  const lastRow     = schedule.at(-1) ?? null
  const nextRow     = schedule.find((r) => r.date >= today) ?? null
  const repaidMinor = mortgage.initial_capital_minor - status.remainingCapitalMinor
  const repaidPct   = mortgage.initial_capital_minor > 0 ? Math.round((repaidMinor / mortgage.initial_capital_minor) * 100) : 0
  const totalInterestMinor = schedule.reduce((sum, r) => sum + r.interestMinor, 0)
  const KEY = 'text-2xl sm:text-3xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] text-(--ink)'

  return (
    <>
    <StickyBar watchId="mutuo-remaining">
      <span className="text-sm font-medium text-(--ink) truncate">{mortgage.name}</span>
      <span className="text-sm text-(--muted)">
        Residuo <span className="font-mono tabular-nums font-semibold text-(--ink)">{fmtEur(status.remainingCapitalMinor)}</span>
      </span>
      <span className="ml-auto text-xs text-(--muted) font-mono tabular-nums">{fmtEur(R)}/mese</span>
    </StickyBar>
    <main className={`${PAGE_SHELL} space-y-8`}>
      <PageHeader
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Mutui', href: '/dashboard/mutui' },
          { label: mortgage.name },
        ]}
        title={mortgage.name}
        description={`${mortgage.duration_months} mesi al ${rateDisplay}% annuo · prima rata ${fmtDate(mortgage.start_date)}${lastRow ? ` · ultima ${fmtDate(lastRow.date)}` : ''}`}
      />

      {/* ── Hero: quanto resta, quanto pago, come si divide la rata ──────── */}
      <HeroShell innerClassName="grid gap-x-14 gap-y-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end p-6 sm:p-8">
        <div className="space-y-5 min-w-0">
          <Eyebrow>Capitale residuo</Eyebrow>
          <p id="mutuo-remaining" className="text-5xl sm:text-6xl font-extrabold font-display tabular-nums leading-none tracking-[-0.03em] text-(--ink)">
            {fmtEur(status.remainingCapitalMinor)}
          </p>
          <div className="space-y-2 max-w-xl">
            <ProgressBar value={repaidMinor} max={mortgage.initial_capital_minor} color="var(--ink)" />
            <p className="text-sm text-(--muted)">
              Rimborsato il <span className="font-mono tabular-nums text-(--ink)">{repaidPct}%</span> di{' '}
              <span className="font-mono tabular-nums text-(--ink)">{fmtEur(mortgage.initial_capital_minor)}</span> erogati
              {nextRow && <> · rata {nextRow.monthIndex} di {mortgage.duration_months}</>}.
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 2xl:grid-cols-4 gap-x-10 gap-y-6 border-t border-(--border) pt-5 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-14">
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-(--muted)">Rata mensile</dt>
            <dd className={KEY}>{fmtEur(R)}</dd>
          </div>
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-(--muted)">di cui interessi</dt>
            <dd className={KEY}>{fmtEur(status.currentRateInterest)}</dd>
            <dd className="text-xs text-(--muted)">rata corrente</dd>
          </div>
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-(--muted)">di cui capitale</dt>
            <dd className={KEY}>{fmtEur(status.currentRatePrincipal)}</dd>
            <dd className="text-xs text-(--muted)">rata corrente</dd>
          </div>
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-(--muted)">Interessi totali</dt>
            <dd className={KEY}>{fmtEur(totalInterestMinor)}</dd>
            <dd className="text-xs text-(--muted)">sull&apos;intera durata</dd>
          </div>
        </dl>
      </HeroShell>

      <div className="grid grid-cols-1 2xl:grid-cols-5 gap-6 2xl:items-start">
      {/* Piano ammortamento — Desktop */}
      <Card noPadding className={`overflow-hidden ${mutuoTxns.length > 0 ? '2xl:col-span-3' : '2xl:col-span-5'}`}>
        <h2 className="text-sm font-semibold text-(--ink) px-4 sm:px-5 pt-4 pb-3">Piano di ammortamento</h2>

        {/* Tabella lunga (fino a 360 righe): scorre dentro la card, intestazione fissa */}
        <ScrollToCurrent className="hidden sm:block relative max-h-[70vh] overflow-y-auto [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:bg-(--surface) [&_thead_th]:z-[1]">
          <TableWrapper className="overflow-x-visible">
            <Table>
              <TableHead>
                <Tr>
                  <Th>#</Th>
                  <Th>Data</Th>
                  <Th className="text-right">Rata</Th>
                  <Th className="text-right">Interessi</Th>
                  <Th className="text-right">Capitale</Th>
                  <Th className="text-right">Residuo</Th>
                </Tr>
              </TableHead>
              <TableBody>
                {schedule.map((row) => {
                  const isCurrent = row.date >= today && (schedule[row.monthIndex - 2]?.date ?? '') < today
                  return (
                    <Tr key={row.monthIndex} className={isCurrent ? 'bg-(--surface-2)' : ''} aria-current={isCurrent ? 'true' : undefined}>
                      <Td className="text-(--muted) tabular-nums">{row.monthIndex}{isCurrent && <Badge variant="neutral" className="ml-2">in corso</Badge>}</Td>
                      <Td className="tabular-nums">{fmtDate(row.date)}</Td>
                      <Td className="text-right font-mono tabular-nums">{fmtEur(row.paymentMinor)}</Td>
                      <Td className="text-right font-mono tabular-nums">{fmtEur(row.interestMinor)}</Td>
                      <Td className="text-right font-mono tabular-nums">{fmtEur(row.principalMinor)}</Td>
                      <Td className="text-right font-mono tabular-nums font-medium">{fmtEur(row.remainingCapitalMinor)}</Td>
                    </Tr>
                  )
                })}
              </TableBody>
            </Table>
          </TableWrapper>
        </ScrollToCurrent>

        {/* Mobile */}
        <div className="sm:hidden divide-y divide-(--border)">
          {schedule.map((row) => {
            const isCurrent = row.date >= today && (schedule[row.monthIndex - 2]?.date ?? '') < today
            return (
              <DataCard key={row.monthIndex} className={isCurrent ? 'bg-(--surface-2)' : ''}>
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
        <Card className="space-y-3 2xl:col-span-2">
          <div>
            <h2 className="text-sm font-semibold text-(--ink)">Rate rilevate sul conto</h2>
            <p className="text-xs text-(--muted) mt-0.5">
              Transazioni categorizzate come «Mutuo» sul conto associato. Lo split interessi/capitale è calcolato teoricamente in base al piano di ammortamento.
            </p>
          </div>
          <div className="hidden sm:block">
            <TableWrapper>
              <Table>
                <TableHead>
                  <Tr>
                    <Th>Data</Th>
                    <Th>Descrizione</Th>
                    <Th className="text-right">Importo</Th>
                    <Th className="text-right">Interessi (teor.)</Th>
                    <Th className="text-right">Capitale (teor.)</Th>
                  </Tr>
                </TableHead>
                <TableBody>
                  {mutuoTxns.map((t, i) => {
                    const schedRow = schedule.find(r => r.date.slice(0, 7) === t.booked_date.slice(0, 7))
                    return (
                      <Tr key={i}>
                        <Td className="tabular-nums">{fmtDate(t.booked_date)}</Td>
                        <Td className="text-(--muted) truncate max-w-[200px]">{t.description_raw}</Td>
                        <Td className="text-right tabular-nums">{fmtEur(Math.abs(t.amount_minor))}</Td>
                        <Td className="text-right font-mono tabular-nums">{schedRow ? fmtEur(schedRow.interestMinor) : '—'}</Td>
                        <Td className="text-right font-mono tabular-nums">{schedRow ? fmtEur(schedRow.principalMinor) : '—'}</Td>
                      </Tr>
                    )
                  })}
                </TableBody>
              </Table>
            </TableWrapper>
          </div>
          <div className="sm:hidden divide-y divide-(--border)">
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
      </div>
    </main>
    </>
  )
}
