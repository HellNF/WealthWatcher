import { requireUser } from '@/lib/dal'
import { listGoals, computeGoalsSummary, isGoalCompleted } from '@/lib/goals'
import { formatMoney } from '@/lib/money'
import GoalForm from './GoalForm'
import GoalAllocateForm from './GoalAllocateForm'
import { deleteGoalAction } from './actions'
import {
  Card, Badge, ConfirmDelete, ProgressBar, PageHeader, HeroShell, Eyebrow, StickyBar, PAGE_SHELL,
} from '@/components/ui'
import { AddSection } from '@/components/dashboard/AddSection'
import { PiggyBank, Target, Wallet, CalendarClock } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fmtEur(minor: number, decimals = 2) {
  return decimals === 2
    ? formatMoney(minor, 'EUR')
    : (minor / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', useGrouping: 'always', maximumFractionDigits: 0 })
}

function fmtDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Rome',
  })
}

/** Mesi interi da oggi alla data obiettivo (minimo 1 se la data è futura). */
function monthsUntil(iso: string, today: string): number {
  const [ty, tm, td] = today.split('-').map(Number)
  const [y, m, d]    = iso.split('-').map(Number)
  const months = (y - ty) * 12 + (m - tm) + (d >= td ? 0 : -1)
  return iso > today ? Math.max(1, months) : 0
}

const KEY = 'text-2xl sm:text-3xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] text-(--ink)'

export default async function ObiettiviPage() {
  const user    = await requireUser()
  const goals   = listGoals(user.id)
  const summary = await computeGoalsSummary(user.id)
  const today   = new Date().toISOString().slice(0, 10)

  const overAllocated = summary.freeOperatingCashMinor < 0
  const totalTarget   = goals.reduce((s, g) => s + g.target_amount_minor, 0)
  const completed     = goals.filter(isGoalCompleted).length
  const targetPct     = totalTarget > 0 ? Math.min(100, Math.round((summary.totalAllocatedMinor / totalTarget) * 100)) : 0

  // ── Primo avvio: l'hero spiega l'idea e contiene già il modulo ──────────────
  if (goals.length === 0) {
    return (
      <main className={`${PAGE_SHELL} space-y-8`}>
        <PageHeader
          breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Obiettivi' }]}
          title="Obiettivi di risparmio"
        />
        <HeroShell innerClassName="grid gap-x-14 gap-y-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,40rem)] xl:items-center p-6 sm:p-8">
          <div className="space-y-6 min-w-0">
            <Eyebrow>Liquidità libera · {fmtEur(summary.freeOperatingCashMinor)}</Eyebrow>
            <h2 className="text-4xl sm:text-5xl font-extrabold font-display leading-[1.05] tracking-[-0.03em] text-(--ink) max-w-[16ch] [text-wrap:balance]">
              Dai un nome ai soldi che metti da parte.
            </h2>
            <p className="text-sm text-(--muted) leading-relaxed max-w-[60ch]">
              Un obiettivo riserva una parte della tua liquidità: il denaro resta sui tuoi conti, ma smette
              di sembrarti spendibile. Così sai sempre quanto è davvero libero.
            </p>
            <ul className="space-y-4 max-w-[60ch]">
              {[
                { icon: Target,        title: 'Un traguardo e una data', text: 'Fondo emergenza, vacanza, auto: quanto serve ed entro quando.' },
                { icon: Wallet,        title: 'Liquidità libera sempre chiara', text: 'Saldo dei conti meno quello che hai già destinato.' },
                { icon: CalendarClock, title: 'Quanto mettere da parte al mese', text: 'Calcolato dalla data che ti sei dato.' },
              ].map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-(--surface-2) ring-1 ring-(--border)">
                    <Icon className="size-4 text-(--muted)" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-(--ink)">{title}</span>
                    <span className="block text-sm text-(--muted)">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-(--surface-2)/60 ring-1 ring-(--border) p-5 sm:p-6 self-start xl:self-center">
            <h3 className="text-sm font-semibold text-(--ink) mb-4">Crea il primo obiettivo</h3>
            <GoalForm />
          </div>
        </HeroShell>
      </main>
    )
  }

  return (
    <>
    <StickyBar watchId="goals-free">
      <span className="text-sm font-medium text-(--ink)">Obiettivi</span>
      <span className="text-sm text-(--muted)">
        Liquidità libera{' '}
        <span className={`font-mono tabular-nums font-semibold ${overAllocated ? 'text-(--danger-text)' : 'text-(--ink)'}`}>
          {fmtEur(summary.freeOperatingCashMinor)}
        </span>
      </span>
      <span className="ml-auto text-xs text-(--muted)">{completed} di {goals.length} completati</span>
    </StickyBar>
    <main className={`${PAGE_SHELL} space-y-8`}>
      <PageHeader
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Obiettivi' }]}
        title="Obiettivi di risparmio"
        description="Riserva una parte della tua liquidità per obiettivi specifici. Il denaro resta sui tuoi conti: solo l'allocazione è virtuale."
      />

      {/* ── Hero: quanto è davvero libero, quanto è già destinato ─────────── */}
      <HeroShell innerClassName="grid gap-x-14 gap-y-8 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end p-6 sm:p-8">
        <div className="space-y-5 min-w-0">
          <Eyebrow>Liquidità libera</Eyebrow>
          <p
            id="goals-free"
            className={`text-5xl sm:text-6xl font-extrabold font-display tabular-nums leading-none tracking-[-0.03em] ${overAllocated ? 'text-(--danger-text)' : 'text-(--ink)'}`}
          >
            {fmtEur(summary.freeOperatingCashMinor)}
          </p>

          {/* Come si divide la liquidità: una fetta per obiettivo, il resto è libero */}
          <div className="space-y-2 max-w-2xl">
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-(--surface-2)" aria-hidden>
              {summary.totalCashMinor > 0 && goals.filter((g) => g.current_allocated_minor > 0).map((g) => (
                <span
                  key={g.id}
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, (g.current_allocated_minor / summary.totalCashMinor) * 100)}%`, background: g.color_hex }}
                />
              ))}
            </div>
            <p className="text-sm text-(--muted)">
              {overAllocated ? (
                <>
                  Hai destinato agli obiettivi <strong className="text-(--danger-text)">{fmtEur(Math.abs(summary.freeOperatingCashMinor))}</strong> più
                  della liquidità che hai sui conti: riduci qualche allocazione.
                </>
              ) : (
                <>
                  Sui conti hai <span className="font-mono tabular-nums text-(--ink)">{fmtEur(summary.totalCashMinor)}</span>,
                  di cui <span className="font-mono tabular-nums text-(--ink)">{fmtEur(summary.totalAllocatedMinor)}</span> già destinati.
                </>
              )}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-10 gap-y-6 border-t border-(--border) pt-5 xl:border-t-0 xl:pt-0 xl:border-l xl:pl-14">
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-(--muted)">Destinata agli obiettivi</dt>
            <dd className={KEY}>{fmtEur(summary.totalAllocatedMinor)}</dd>
          </div>
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-(--muted)">Traguardo complessivo</dt>
            <dd className={KEY}>{fmtEur(totalTarget, 0)}</dd>
            <dd className="text-xs text-(--muted)">raggiunto al {targetPct}%</dd>
          </div>
          <div className="space-y-1.5">
            <dt className="text-xs font-medium text-(--muted)">Completati</dt>
            <dd className={KEY}>{completed} di {goals.length}</dd>
          </div>
        </dl>
      </HeroShell>

      {/* ── Gli obiettivi ─────────────────────────────────────────────────── */}
      <AddSection
        title="I tuoi obiettivi"
        icon={<PiggyBank className="size-4 text-(--muted)" strokeWidth={1.75} />}
        addLabel="Nuovo obiettivo"
        form={<Card className="max-w-xl"><GoalForm /></Card>}
      >
        <div className="flex flex-wrap gap-4">
          {goals.map((g) => {
            const done      = isGoalCompleted(g)
            const pct       = g.target_amount_minor > 0
              ? Math.min(100, Math.round((g.current_allocated_minor / g.target_amount_minor) * 100))
              : 0
            const missing   = Math.max(0, g.target_amount_minor - g.current_allocated_minor)
            const months    = g.target_date ? monthsUntil(g.target_date, today) : 0
            const overdue   = !!g.target_date && g.target_date <= today && !done

            return (
              <Card key={g.id} noPadding className="flex-1 basis-[26rem] min-w-0 flex flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-3 p-4 sm:p-5 pb-0 sm:pb-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="size-2.5 rounded-full shrink-0" style={{ background: g.color_hex }} aria-hidden />
                    <h3 className="text-base font-semibold text-(--ink) truncate">{g.name}</h3>
                    {done && <Badge variant="success">Completato</Badge>}
                  </div>
                  <ConfirmDelete
                    action={deleteGoalAction.bind(null, g.id)}
                    label="Elimina"
                    confirmText={`Eliminare l'obiettivo "${g.name}"?`}
                  />
                </div>

                <div className="p-4 sm:p-5 space-y-3">
                  <p className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-2xl font-medium font-mono tabular-nums leading-none text-(--ink)">{fmtEur(g.current_allocated_minor)}</span>
                    <span className="text-sm text-(--muted)">di <span className="font-mono tabular-nums">{fmtEur(g.target_amount_minor)}</span></span>
                    <span className="ml-auto text-sm font-mono tabular-nums text-(--muted)">{pct}%</span>
                  </p>
                  <ProgressBar value={g.current_allocated_minor} max={g.target_amount_minor} color={g.color_hex} />
                  <p className="text-xs text-(--muted) min-h-4">
                    {done ? 'Traguardo raggiunto.'
                      : overdue ? <>Scadenza passata il {fmtDay(g.target_date!)}: mancano <span className="font-mono tabular-nums">{fmtEur(missing)}</span>.</>
                      : g.target_date ? <>Entro il {fmtDay(g.target_date)}: servono <span className="font-mono tabular-nums text-(--ink)">{fmtEur(Math.ceil(missing / months))}</span> al mese per {months} {months === 1 ? 'mese' : 'mesi'}.</>
                      : <>Mancano <span className="font-mono tabular-nums">{fmtEur(missing)}</span>.</>}
                  </p>
                </div>

                <div className="mt-auto border-t border-(--border) bg-(--surface-2)/40 p-4 sm:p-5">
                  <GoalAllocateForm goalId={g.id} freeMinor={summary.freeOperatingCashMinor} allocatedMinor={g.current_allocated_minor} />
                </div>
              </Card>
            )
          })}
        </div>
      </AddSection>
    </main>
    </>
  )
}
