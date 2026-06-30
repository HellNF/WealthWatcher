import { requireUser } from '@/lib/dal'
import { listInstitutions } from '@/lib/institutions'
import AddInstitutionForm from './AddInstitutionForm'
import NetWorthChart from './NetWorthChart'
import { ensureTodaySnapshot, listSnapshots } from '@/lib/valuation'
import {
  Card, CardHeader, CardTitle,
  Stat, Badge, EmptyState,
} from '@/components/ui'
import Link from 'next/link'
import { Building2, ChevronRight, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  bank:   'Banca',
  broker: 'Broker',
  both:   'Banca · Broker',
}

function formatEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
  })
}

function formatEurCompact(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })
}

export default async function DashboardPage() {
  const user = await requireUser()
  const institutions = listInstitutions(user.id)

  await ensureTodaySnapshot(user.id).catch(() => {})

  const snapshots = listSnapshots(user.id)
  const latest  = snapshots.at(-1) ?? null
  const prev    = snapshots.at(-2) ?? null

  // Delta rispetto allo snapshot precedente
  const delta = latest && prev
    ? latest.net_worth_eur_minor - prev.net_worth_eur_minor
    : null

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8">

      {/* ── Net worth hero ────────────────────────────────────────────────── */}
      <Card noPadding className="overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-[--brand] to-[--brand-subtle]" />
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            {/* Valore principale */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-[--muted] uppercase tracking-wide">
                Patrimonio netto
              </p>
              {latest ? (
                <div className="flex items-end gap-3 flex-wrap">
                  <span className="text-4xl font-bold font-mono tabular-nums text-[--ink] leading-none">
                    {formatEur(latest.net_worth_eur_minor)}
                  </span>
                  {delta !== null && (
                    <Badge variant={delta >= 0 ? 'gain' : 'loss'} className="mb-1">
                      {delta >= 0 ? '+' : ''}
                      {formatEurCompact(delta)}
                    </Badge>
                  )}
                  {latest.stale === 1 && (
                    <Badge variant="warning" className="mb-1">parziale</Badge>
                  )}
                </div>
              ) : (
                <span className="text-[--muted] text-sm">Calcolo in corso…</span>
              )}
              {latest && (
                <p className="text-xs text-[--faint]">
                  Aggiornato al {latest.date}
                </p>
              )}
            </div>

            {/* Breakdown */}
            {latest && (
              <div className="flex gap-8 flex-wrap">
                <Stat
                  label="Investimenti"
                  value={formatEurCompact(latest.investments_eur_minor)}
                  size="sm"
                />
                <Stat
                  label="Conti correnti"
                  value={formatEurCompact(latest.accounts_eur_minor)}
                  size="sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Chart — a filo con la card, senza padding laterale extra */}
        <div className="px-2 pb-4">
          <NetWorthChart snapshots={snapshots} />
        </div>
      </Card>

      {/* ── Istituzioni ───────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[--ink]">Istituzioni</h2>
        </div>

        <Card>
          <AddInstitutionForm />
        </Card>

        {institutions.length === 0 ? (
          <Card>
            <EmptyState
              icon={Building2}
              title="Nessuna istituzione"
              description="Aggiungi la tua prima banca o broker per iniziare a tracciare il patrimonio."
            />
          </Card>
        ) : (
          <Card noPadding className="overflow-hidden divide-y divide-[--border]">
            {institutions.map((inst) => (
              <Link
                key={inst.id}
                href={`/dashboard/institutions/${inst.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-[--surface-2] transition-colors duration-100 group"
              >
                {/* Avatar lettera */}
                <div className="size-9 rounded-xl bg-[--brand-subtle] flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-[--brand-text]">
                    {inst.name[0].toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[--ink] truncate">{inst.name}</p>
                  <p className="text-xs text-[--muted]">{KIND_LABEL[inst.kind] ?? inst.kind}</p>
                </div>

                <ChevronRight className="size-4 text-[--faint] group-hover:text-[--muted] transition-colors shrink-0" />
              </Link>
            ))}
          </Card>
        )}
      </section>
    </main>
  )
}
