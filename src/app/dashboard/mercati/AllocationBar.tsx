// src/app/dashboard/mercati/AllocationBar.tsx — Barra impilata della
// composizione per classe di asset + legenda. Server Component puro.
import type { AllocationResult } from '@/lib/marketOverview/allocation'
import type { ExposureResult } from '@/lib/marketOverview/lookthrough'
import { CLUSTER_LABEL, CLUSTER_COLOR, EXPOSURE_LABEL, EXPOSURE_COLOR, SECTOR_LABEL } from './meta'

function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', useGrouping: 'always', currency: 'EUR', maximumFractionDigits: 0 })
}

export function AllocationBar({ allocation }: { allocation: AllocationResult }) {
  const { byCluster, totalEurMinor } = allocation

  return (
    <div className="space-y-4">
      {/* Barra impilata */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-(--surface-2)" role="img" aria-label="Composizione del portafoglio per classe di asset">
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
              <span className="text-xs font-medium text-(--ink)">{CLUSTER_LABEL[c.cluster]}</span>
            </div>
            <span className="text-sm font-semibold font-mono tabular-nums text-(--ink)">
              {c.pct.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%
            </span>
            <span className="text-xs text-(--muted) font-mono tabular-nums">{fmtEur(c.valueEurMinor)}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-(--muted)">
        Totale valorizzato: <span className="font-mono tabular-nums text-(--muted)">{fmtEur(totalEurMinor)}</span>
        {allocation.hasStalePrices && ' · alcune posizioni sono escluse perché senza prezzo aggiornato'}
      </p>
    </div>
  )
}

/**
 * Esposizione effettiva: la stessa cifra, ma scomponendo ogni fondo/ETF in ciò
 * che contiene davvero. È la vista da confrontare con le valutazioni di mercato.
 */
export function ExposureBar({ exposure }: { exposure: ExposureResult }) {
  const top = exposure.sectors.slice(0, 5)
  const unknown = exposure.slices.find((s) => s.key === 'unknown')

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-(--ink)">Cosa possiedi davvero, guardando dentro i fondi</p>
        <p className="text-xs text-(--muted) leading-relaxed max-w-[75ch]">
          Un fondo o un ETF può contenere azioni, obbligazioni e liquidità insieme. Qui ogni fondo è scomposto nel suo
          contenuto: è questa la ripartizione da confrontare con le valutazioni qui sopra.
        </p>
      </div>

      <div className="flex h-3 w-full overflow-hidden rounded-full bg-(--surface-2)" role="img" aria-label="Esposizione effettiva del portafoglio per classe di investimento">
        {exposure.slices.map((s) => (
          <div key={s.key} style={{ width: `${s.pct}%`, background: EXPOSURE_COLOR[s.key] }} title={`${EXPOSURE_LABEL[s.key]}: ${Math.round(s.pct)}%`} />
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {exposure.slices.map((s) => (
          <div key={s.key} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full shrink-0" style={{ background: EXPOSURE_COLOR[s.key] }} aria-hidden />
              <span className="text-xs font-medium text-(--ink)">{EXPOSURE_LABEL[s.key]}</span>
            </div>
            <span className="text-sm font-semibold font-mono tabular-nums text-(--ink)">
              {s.pct.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%
            </span>
            <span className="text-xs text-(--muted) font-mono tabular-nums">{fmtEur(s.valueEurMinor)}</span>
          </div>
        ))}
      </div>

      {top.length > 0 && (
        <p className="text-xs text-(--muted) leading-relaxed">
          <span className="text-(--ink) font-medium">Settori più presenti nella parte azionaria: </span>
          {top.map((s) => `${SECTOR_LABEL[s.key] ?? s.key} ${Math.round(s.pct)}%`).join(' · ')}
        </p>
      )}

      <p className="text-xs text-(--muted)">
        {unknown && 'Per alcuni fondi la composizione non è pubblicata: restano indicati a parte. '}
        Composizione dei fondi: Yahoo Finance (dati Morningstar), aggiornata periodicamente dai gestori.
      </p>
    </div>
  )
}
