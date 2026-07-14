// src/app/dashboard/mercati/AllocationBar.tsx — Barra impilata della
// composizione per classe di asset + legenda. Server Component puro.
import type { AllocationResult } from '@/lib/marketOverview/allocation'
import { CLUSTER_LABEL, CLUSTER_COLOR } from './meta'

function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

export function AllocationBar({ allocation }: { allocation: AllocationResult }) {
  const { byCluster, totalEurMinor } = allocation

  return (
    <div className="space-y-4">
      {/* Barra impilata */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[--surface-2]" role="img" aria-label="Composizione del portafoglio per classe di asset">
        {byCluster.map((c) => (
          <div
            key={c.cluster}
            style={{ width: `${c.pct}%`, background: CLUSTER_COLOR[c.cluster] }}
            title={`${CLUSTER_LABEL[c.cluster]}: ${Math.round(c.pct)}%`}
          />
        ))}
      </div>

      {/* Legenda */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {byCluster.map((c) => (
          <div key={c.cluster} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full shrink-0" style={{ background: CLUSTER_COLOR[c.cluster] }} aria-hidden />
              <span className="text-xs font-medium text-[--ink]">{CLUSTER_LABEL[c.cluster]}</span>
            </div>
            <span className="text-sm font-semibold font-mono tabular-nums text-[--ink]">
              {c.pct.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%
            </span>
            <span className="text-[11px] text-[--faint] font-mono tabular-nums">{fmtEur(c.valueEurMinor)}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-[--faint]">
        Totale valorizzato: <span className="font-mono tabular-nums text-[--muted]">{fmtEur(totalEurMinor)}</span>
        {allocation.hasStalePrices && ' · alcune posizioni sono escluse perché senza prezzo aggiornato'}
      </p>
    </div>
  )
}
