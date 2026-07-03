import { requireUser } from '@/lib/dal'
import { listInstitutions } from '@/lib/institutions'
import { getInstitutionValueEur } from '@/lib/institutionValuation'
import { listAssets } from '@/lib/assets'
import { listAccounts } from '@/lib/accounts'
import { listPortfolios } from '@/lib/portfolios'
import AddInstitutionForm from './AddInstitutionForm'
import AddAssetForm from './AddAssetForm'
import AssetRow from './AssetRow'
import NetWorthChart from './NetWorthChart'
import { ensureTodaySnapshot, listSnapshots } from '@/lib/valuation'
import { AddSection } from '@/components/dashboard/AddSection'
import {
  Card,
  Stat, Badge, EmptyState,
} from '@/components/ui'
import Link from 'next/link'
import { Building2, ChevronRight, Wallet } from 'lucide-react'

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

interface BreakdownEntry {
  portfolios: { portfolioId: number; eurMinor: number | null }[]
  accounts:   { accountId: number; eurMinor: number }[]
}

export default async function DashboardPage() {
  const user = await requireUser()
  const institutions = listInstitutions(user.id)

  await ensureTodaySnapshot(user.id).catch(() => {})

  const snapshots = listSnapshots(user.id)
  const latest  = snapshots.at(-1) ?? null
  const prev    = snapshots.at(-2) ?? null

  const delta = latest && prev
    ? latest.net_worth_eur_minor - prev.net_worth_eur_minor
    : null

  const today = new Date().toISOString().slice(0, 10)
  const instValues = await Promise.all(
    institutions.map((inst) => getInstitutionValueEur(user.id, inst.id, today)),
  )

  const assets     = listAssets(user.id)
  const accounts   = listAccounts(user.id)
  const portfolios = listPortfolios(user.id)

  // Institution names for badge display
  const institutionMap = new Map(institutions.map(i => [i.id, i.name]))

  // Per-account and per-portfolio EUR values from the latest snapshot breakdown
  const accountValueMap   = new Map<number, number>()
  const portfolioValueMap = new Map<number, number>()
  if (latest?.breakdown) {
    try {
      const bd = JSON.parse(latest.breakdown) as BreakdownEntry
      for (const a of bd.accounts ?? [])   accountValueMap.set(a.accountId, a.eurMinor)
      for (const p of bd.portfolios ?? []) if (p.eurMinor !== null) portfolioValueMap.set(p.portfolioId, p.eurMinor)
    } catch {
      // ignore malformed breakdown
    }
  }

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8">

      {/* ── Net worth hero ────────────────────────────────────────────────── */}
      <Card noPadding className="overflow-hidden">
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between gap-6 flex-wrap">
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
                {latest.other_assets_eur_minor !== 0 && (
                  <Stat
                    label="Altri beni"
                    value={formatEurCompact(latest.other_assets_eur_minor)}
                    size="sm"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-2 pb-4">
          <NetWorthChart snapshots={snapshots} />
        </div>
      </Card>

      {/* ── Conti correnti (accesso rapido) ──────────────────────────────── */}
      {accounts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[--ink]">Conti correnti</h2>
          <Card noPadding className="overflow-hidden divide-y divide-[--border]">
            {accounts.map((acc) => {
              const instName = institutionMap.get(acc.institution_id)
              const eurMinor = accountValueMap.get(acc.id)
              return (
                <Link
                  key={acc.id}
                  href={`/dashboard/accounts/${acc.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[--surface-2] transition-colors duration-100 group"
                >
                  <div className="size-9 rounded-xl bg-[--surface-2] ring-1 ring-[--border] flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-[--muted]">
                      {acc.name[0].toUpperCase()}
                    </span>
                  </div>
                  <p className="flex-1 min-w-0 text-sm font-medium text-[--ink] truncate">
                    {acc.name}
                  </p>
                  {instName && (
                    <Badge variant="neutral" className="shrink-0">{instName}</Badge>
                  )}
                  <span className="font-mono tabular-nums text-sm text-[--ink] shrink-0">
                    {eurMinor !== undefined ? formatEurCompact(eurMinor) : '—'}
                  </span>
                  <ChevronRight className="size-4 text-[--faint] group-hover:text-[--muted] transition-colors shrink-0" />
                </Link>
              )
            })}
          </Card>
        </section>
      )}

      {/* ── Portafogli d'investimento (accesso rapido) ───────────────────── */}
      {portfolios.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[--ink]">Portafogli d&apos;investimento</h2>
          <Card noPadding className="overflow-hidden divide-y divide-[--border]">
            {portfolios.map((pf) => {
              const instName = institutionMap.get(pf.institution_id)
              const eurMinor = portfolioValueMap.get(pf.id)
              return (
                <Link
                  key={pf.id}
                  href={`/dashboard/portfolios/${pf.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[--surface-2] transition-colors duration-100 group"
                >
                  <div className="size-9 rounded-xl bg-[--brand-subtle] flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-[--brand-text]">
                      {pf.name[0].toUpperCase()}
                    </span>
                  </div>
                  <p className="flex-1 min-w-0 text-sm font-medium text-[--ink] truncate">
                    {pf.name}
                  </p>
                  {instName && (
                    <Badge variant="neutral" className="shrink-0">{instName}</Badge>
                  )}
                  <span className="font-mono tabular-nums text-sm text-[--ink] shrink-0">
                    {eurMinor !== undefined ? formatEurCompact(eurMinor) : '—'}
                  </span>
                  <ChevronRight className="size-4 text-[--faint] group-hover:text-[--muted] transition-colors shrink-0" />
                </Link>
              )
            })}
          </Card>
        </section>
      )}

      {/* ── Istituzioni ───────────────────────────────────────────────────── */}
      <AddSection
        title="Istituzioni"
        addLabel="Aggiungi"
        form={
          <Card>
            <AddInstitutionForm />
          </Card>
        }
      >
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
            {institutions.map((inst, i) => {
              const val = instValues[i]
              return (
                <Link
                  key={inst.id}
                  href={`/dashboard/institutions/${inst.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-[--surface-2] transition-colors duration-100 group"
                >
                  <div className="size-9 rounded-xl bg-[--brand-subtle] flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-[--brand-text]">
                      {inst.name[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[--ink] truncate">{inst.name}</p>
                    <p className="text-xs text-[--muted]">{KIND_LABEL[inst.kind] ?? inst.kind}</p>
                  </div>
                  <span className="font-mono tabular-nums text-sm text-[--ink] shrink-0">
                    {formatEur(val.valueEurMinor)}
                    {val.stale && <span className="text-[--warning] ml-1" title="Valore parziale">*</span>}
                  </span>
                  <ChevronRight className="size-4 text-[--faint] group-hover:text-[--muted] transition-colors shrink-0" />
                </Link>
              )
            })}
          </Card>
        )}
      </AddSection>

      {/* ── Altri beni ────────────────────────────────────────────────────── */}
      <AddSection
        title="Altri beni"
        subtitle="Liquidità, immobili, veicoli e altro — concorrono al patrimonio netto."
        addLabel="Aggiungi"
        form={
          <Card>
            <AddAssetForm />
          </Card>
        }
      >
        {assets.length === 0 ? (
          <Card>
            <EmptyState
              icon={Wallet}
              title="Nessun bene aggiunto"
              description="Aggiungi contanti, un immobile o un veicolo per includerli nel patrimonio."
            />
          </Card>
        ) : (
          <Card noPadding className="overflow-hidden divide-y divide-[--border]">
            {assets.map((asset) => (
              <AssetRow key={asset.id} asset={asset} />
            ))}
          </Card>
        )}
      </AddSection>
    </main>
  )
}
