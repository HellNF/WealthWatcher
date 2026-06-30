import { requireUser } from '@/lib/dal'
import { listInstitutions } from '@/lib/institutions'
import AddInstitutionForm from './AddInstitutionForm'
import NetWorthChart from './NetWorthChart'
import { ensureTodaySnapshot, listSnapshots } from '@/lib/valuation'
import {
  Card,
  Stat, EmptyState,
} from '@/components/ui'
import Link from 'next/link'
import { Building2, ChevronRight, TrendingUp } from 'lucide-react'

export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  bank:   'Banca',
  broker: 'Broker',
  both:   'Banca · Broker',
}

// Palette tile colorate (stile N26/Revolut) — colore deterministico dal nome
const AVATAR_COLORS = [
  'oklch(0.55 0.15 198)', // teal
  'oklch(0.55 0.19 268)', // indigo
  'oklch(0.58 0.16 150)', // verde
  'oklch(0.62 0.20 25)',  // corallo
  'oklch(0.60 0.17 300)', // viola
  'oklch(0.62 0.16 55)',  // ambra
]

function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
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
      <Card noPadding className="overflow-hidden shadow-[--shadow-lg]">
        {/* Hero gradiente teal→cyan — testo sempre bianco */}
        <div
          className="relative px-6 pt-6 pb-5 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, var(--brand-grad-from), var(--brand-grad-to))',
            '--ink':   'oklch(1 0 0)',
            '--muted': 'oklch(1 0 0 / 0.65)',
            '--faint': 'oklch(1 0 0 / 0.45)',
          } as React.CSSProperties}
        >
          {/* Glow decorativo per profondità */}
          <div className="absolute -top-20 -right-12 size-56 rounded-full bg-white/10 blur-3xl pointer-events-none" aria-hidden />
          <div className="relative flex items-start justify-between gap-6 flex-wrap">
            {/* Valore principale */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">
                Patrimonio netto
              </p>
              {latest ? (
                <div className="flex items-end gap-3 flex-wrap">
                  <span className="text-4xl font-bold font-mono tabular-nums text-white leading-none">
                    {formatEur(latest.net_worth_eur_minor)}
                  </span>
                  {delta !== null && (
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold mb-1 ${
                      delta >= 0
                        ? 'bg-white/20 text-white'
                        : 'bg-black/20 text-red-200'
                    }`}>
                      {delta >= 0 ? '+' : ''}{formatEurCompact(delta)}
                    </span>
                  )}
                  {latest.stale === 1 && (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mb-1 bg-white/15 text-white/75">
                      parziale
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-white/60 text-sm">Calcolo in corso…</span>
              )}
              {latest && (
                <p className="text-xs text-white/45">
                  Aggiornato al {latest.date}
                </p>
              )}
            </div>

            {/* Breakdown — Stat usa --ink/--muted ridefiniti → testo bianco */}
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

        {/* Chart — superficie neutra sotto la zona colorata */}
        <div className="bg-[--surface] px-2 pb-4 pt-2">
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
                {/* Avatar tile colorata */}
                <div
                  className="size-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                  style={{ background: avatarColor(inst.name) }}
                >
                  <span className="text-base font-bold text-white">
                    {inst.name[0].toUpperCase()}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[--ink] truncate">{inst.name}</p>
                  <p className="text-xs text-[--muted]">{KIND_LABEL[inst.kind] ?? inst.kind}</p>
                </div>

                <ChevronRight className="size-4 text-[--faint] group-hover:text-[--brand] group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
              </Link>
            ))}
          </Card>
        )}
      </section>
    </main>
  )
}
