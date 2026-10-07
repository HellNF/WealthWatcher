// src/app/dashboard/mercati/PerformanceTable.tsx — "Come si stanno muovendo i
// mercati": quanto ha reso cosa, su più orizzonti. Puramente descrittiva.
// Server Component.
import { Card } from '@/components/ui'
import type { PerfRow, PerfGroup } from '@/lib/marketOverview/performance'
import { fmtSignedPct, toneClass, fmtNum } from './format'

const GROUP_LABEL: Record<Exclude<PerfGroup, 'sector'>, string> = {
  equity:      'Azioni',
  bonds:       'Obbligazioni',
  commodities: 'Materie prime',
  crypto:      'Criptovalute',
}

const COLS: { key: keyof PerfRow['returns']; label: string; hideOnMobile?: boolean }[] = [
  { key: 'm1',    label: '1 mese' },
  { key: 'm3',    label: '3 mesi', hideOnMobile: true },
  { key: 'ytd',   label: 'Da inizio anno' },
  { key: 'y1',    label: '1 anno' },
  { key: 'y5ann', label: '5 anni (media annua)', hideOnMobile: true },
]

function Cell({ v, className = '' }: { v: number | null; className?: string }) {
  return (
    <td className={`px-3 py-2 text-right text-sm font-mono tabular-nums whitespace-nowrap ${toneClass(v)} ${className}`}>
      {fmtSignedPct(v)}
    </td>
  )
}

function Rows({ rows }: { rows: PerfRow[] }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.key} className="border-t border-(--border)">
          <th scope="row" className="px-3 py-2 text-left font-normal">
            <span className="block text-sm text-(--ink)">{r.title}</span>
            <span className="block text-xs text-(--muted)">{r.detail}{r.currency ? ` · ${r.currency}` : ''}</span>
          </th>
          {COLS.map((c) => <Cell key={c.key} v={r.returns[c.key]} className={c.hideOnMobile ? 'hidden sm:table-cell' : ''} />)}
          <td className="hidden md:table-cell px-3 py-2 text-right text-sm font-mono tabular-nums whitespace-nowrap text-(--muted)">
            {r.drawdownPct === null ? '–' : r.drawdownPct < 0.05 ? 'sui massimi' : `−${fmtNum(r.drawdownPct)}%`}
          </td>
        </tr>
      ))}
    </>
  )
}

function Table({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-(--muted)">Mercato</th>
            {COLS.map((c) => (
              <th key={c.key} scope="col" className={`px-3 py-2 text-right text-xs font-medium text-(--muted) ${c.hideOnMobile ? 'hidden sm:table-cell' : ''}`}>
                {c.label}
              </th>
            ))}
            <th scope="col" className="hidden md:table-cell px-3 py-2 text-right text-xs font-medium text-(--muted)">Dal massimo dell’anno</th>
          </tr>
        </thead>
        {children}
      </table>
    </div>
  )
}

export function PerformanceTable({ rows }: { rows: PerfRow[] }) {
  const groups = (Object.keys(GROUP_LABEL) as (keyof typeof GROUP_LABEL)[])
    .map((g) => ({ g, rows: rows.filter((r) => r.group === g) }))
    .filter((x) => x.rows.length > 0)
  // Settori ordinati dal migliore al peggiore sull'ultimo anno: si vede subito chi traina.
  const sectors = rows.filter((r) => r.group === 'sector').sort((a, b) => (b.returns.y1 ?? -Infinity) - (a.returns.y1 ?? -Infinity))

  return (
    <div className="space-y-4">
      <Card noPadding className="py-2">
        <Table caption="Rendimenti dei principali mercati su più orizzonti">
          {groups.map(({ g, rows: groupRows }) => (
            <tbody key={g}>
              <tr>
                <th colSpan={COLS.length + 2} scope="colgroup" className="px-3 pt-4 pb-1 text-left text-xs font-semibold text-(--muted)">
                  {GROUP_LABEL[g]}
                </th>
              </tr>
              <Rows rows={groupRows} />
            </tbody>
          ))}
        </Table>
      </Card>

      {sectors.length > 0 && (
        <Card noPadding className="py-2">
          <details>
            <summary className="cursor-pointer px-4 sm:px-5 py-2 text-sm font-medium text-(--ink) select-none">
              Settori della borsa americana ({sectors.length})
              <span className="block text-xs font-normal text-(--muted)">
                Quali comparti stanno trainando e quali restano indietro, ordinati per rendimento a un anno.
              </span>
            </summary>
            <Table caption="Rendimenti dei settori dell'azionario USA">
              <tbody><Rows rows={sectors} /></tbody>
            </Table>
          </details>
        </Card>
      )}

      <p className="text-xs text-(--muted) leading-relaxed max-w-[75ch]">
        Rendimenti nella valuta indicata, non convertiti in euro: per chi investe dall’Italia il risultato effettivo dipende
        anche dal cambio. Dove è indicato «ETF» i dividendi o le cedole sono inclusi; gli indici (S&amp;P 500, STOXX 600, FTSE MIB,
        Nikkei) non li includono. Un rendimento passato elevato non dice nulla su quello futuro. Fonte: Yahoo Finance.
      </p>
    </div>
  )
}
