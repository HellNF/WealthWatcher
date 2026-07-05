import { requireUser } from '@/lib/dal'
import { listGoals, computeGoalsSummary, isGoalCompleted } from '@/lib/goals'
import { fromMinor } from '@/lib/money'
import GoalForm from './GoalForm'
import GoalAllocateForm from './GoalAllocateForm'
import { deleteGoalAction } from './actions'
import {
  Breadcrumb, Card, Stat, Badge, EmptyState, ConfirmDelete, ProgressBar,
} from '@/components/ui'
import { PiggyBank } from 'lucide-react'

export const dynamic = 'force-dynamic'

function fmtEur(minor: number) {
  return fromMinor(minor, 'EUR')
}

export default async function ObiettiviPage() {
  const user    = await requireUser()
  const goals   = listGoals(user.id)
  const summary = await computeGoalsSummary(user.id)

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Obiettivi' },
      ]} />

      <div>
        <h1 className="text-xl font-semibold text-[--ink]">Obiettivi di risparmio</h1>
        <p className="text-sm text-[--muted] mt-0.5">
          Riserva mentalmente una parte della tua liquidità per obiettivi specifici.
          Il denaro resta sui tuoi conti; solo l&apos;allocazione è virtuale.
        </p>
      </div>

      {/* Hero liquidità */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[--brand-subtle]">
          <Stat
            label="Liquidità libera"
            value={fmtEur(summary.freeOperatingCashMinor)}
            sub="disponibile per le spese"
          />
        </Card>
        <Card>
          <Stat label="Liquidità totale sui conti" value={fmtEur(summary.totalCashMinor)} />
        </Card>
        <Card>
          <Stat label="Allocata agli obiettivi" value={fmtEur(summary.totalAllocatedMinor)} />
        </Card>
      </div>

      {summary.freeOperatingCashMinor < 0 && (
        <Card className="border-[--danger] bg-[--danger]/5">
          <p className="text-sm text-[--danger] font-medium">
            Attenzione: hai allocato più della liquidità reale disponibile ({fmtEur(Math.abs(summary.freeOperatingCashMinor))} di sbilancio).
            Considera di ridurre alcune allocazioni.
          </p>
        </Card>
      )}

      {/* Lista obiettivi */}
      {goals.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Nessun obiettivo impostato"
          description="Crea il tuo primo obiettivo (vacanza, fondo d'emergenza, acquisto auto...) e tieni traccia dei progressi."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const completed = isGoalCompleted(g)
            const pct = g.target_amount_minor > 0
              ? Math.min(100, Math.round((g.current_allocated_minor / g.target_amount_minor) * 100))
              : 0

            return (
              <Card key={g.id} className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="size-3 rounded-full shrink-0"
                      style={{ background: g.color_hex }}
                    />
                    <span className="font-semibold text-[--ink] truncate">{g.name}</span>
                    {completed && <Badge variant="success">Completato</Badge>}
                  </div>
                  <ConfirmDelete
                    action={deleteGoalAction.bind(null, g.id)}
                    label="Elimina"
                    confirmText={`Eliminare l'obiettivo "${g.name}"?`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Stat label="Allocato"  value={fmtEur(g.current_allocated_minor)} size="sm" />
                  <Stat label="Obiettivo" value={fmtEur(g.target_amount_minor)}     size="sm" />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-[--muted]">
                    <span>Progresso</span>
                    <span className="tabular-nums">{pct}%</span>
                  </div>
                  <ProgressBar
                    value={g.current_allocated_minor}
                    max={g.target_amount_minor}
                    color={completed ? 'var(--brand)' : g.color_hex}
                  />
                  {g.target_date && (
                    <p className="text-xs text-[--faint]">Entro il {g.target_date}</p>
                  )}
                </div>

                <GoalAllocateForm goalId={g.id} freeMinor={summary.freeOperatingCashMinor} allocatedMinor={g.current_allocated_minor} />
              </Card>
            )
          })}
        </div>
      )}

      {/* Aggiungi obiettivo */}
      <Card className="max-w-xl">
        <h2 className="text-sm font-semibold text-[--ink] mb-4">Nuovo obiettivo</h2>
        <GoalForm />
      </Card>
    </main>
  )
}
