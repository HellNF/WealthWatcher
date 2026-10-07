// src/app/dashboard/mercati/EvidenceSection.tsx — "Cosa dice la storia":
// frequenze storiche calcolate sul dataset Shiller (borsa USA dal 1871). È la
// risposta più onesta a "è il momento giusto?": non una previsione, ma com'è
// andata in passato a chi è partito da condizioni simili. Server Component.
import { Card, Badge } from '@/components/ui'
import type { StoredEquityEvidence, CapeBucket, Distribution } from '@/lib/marketOverview/evidence'
import SourceLink from './SourceLink'
import { fmtNum, fmtSignedPct, toneClass } from './format'

const pctCases = (d: Distribution, worst?: number) =>
  d.pctNegative === 0 && worst !== undefined && worst < 0 ? 'meno dell’1%' : `${d.pctNegative}%`

// Scala comune delle barre "intervallo": da −6% a +18% annuo.
const LO = -6, HI = 18
const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - LO) / (HI - LO)) * 100))}%`

/** Barra p10–p90 con tacca sulla mediana e linea dello zero. */
function RangeBar({ d, highlight }: { d: Distribution; highlight: boolean }) {
  const left = Math.max(LO, d.p10), right = Math.min(HI, d.p90)
  return (
    <div
      className="relative h-3 w-full rounded-full"
      style={{ background: 'var(--surface-2)' }}
      role="img"
      aria-label={`Da ${fmtSignedPct(d.p10)} a ${fmtSignedPct(d.p90)} l'anno, valore tipico ${fmtSignedPct(d.median)}`}
    >
      <span
        className="absolute inset-y-0 rounded-full"
        style={{ left: pos(left), width: `calc(${pos(right)} - ${pos(left)})`, background: highlight ? 'var(--brand)' : 'var(--muted)', opacity: highlight ? 0.7 : 0.45 }}
      />
      <span className="absolute -inset-y-1 w-px" style={{ left: pos(0), background: 'var(--faint)' }} title="0%" />
      <span className="absolute -inset-y-0.5 w-0.5 rounded-full" style={{ left: pos(d.median), background: 'var(--ink)' }} />
    </div>
  )
}

function BucketRow({ b }: { b: CapeBucket }) {
  return (
    <li className={`grid grid-cols-[5.5rem_1fr_4.5rem] sm:grid-cols-[7rem_1fr_5rem_6.5rem] items-center gap-3 px-3 py-2 rounded-lg ${b.current ? 'bg-(--brand-subtle)' : ''}`}>
      <span className="text-sm text-(--ink)">
        {b.label}
        {b.current && <span className="block text-xs font-semibold text-(--brand-text)">oggi siamo qui</span>}
      </span>
      <RangeBar d={b} highlight={b.current} />
      <span className={`text-sm font-mono tabular-nums text-right ${toneClass(b.median)}`}>{fmtSignedPct(b.median)}</span>
      <span className="hidden sm:block text-xs font-mono tabular-nums text-right text-(--muted)">{b.pctNegative}% in perdita</span>
    </li>
  )
}

export function EvidenceSection({ evidence }: { evidence: StoredEquityEvidence }) {
  const current = evidence.buckets.find((b) => b.current)
  const tenYearHigh = evidence.highs.find((h) => h.years === 10)
  const totalYears = parseInt(evidence.asOf.slice(0, 4), 10) - evidence.firstYear

  return (
    <div className="space-y-4">
      <p className="text-sm text-(--muted) leading-relaxed max-w-[75ch]">
        Nessun indicatore sa dire quando un mercato salirà o scenderà. Quello che si può fare è guardare com’è andata, in{' '}
        {totalYears} anni di borsa americana, a chi è partito da condizioni simili a quelle di oggi. I rendimenti sono
        annui, al netto dell’inflazione e con i dividendi reinvestiti. Sono frequenze del passato, non previsioni — e la
        borsa USA è stata una delle migliori al mondo: altri mercati hanno reso meno.
      </p>

      {/* 1 — Valutazione di partenza */}
      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h3 className="text-base font-semibold text-(--ink)">Il prezzo a cui si entra conta, sul lungo periodo</h3>
          <Badge variant="neutral">CAPE oggi: {fmtNum(evidence.cape)}</Badge>
        </div>
        <p className="text-sm text-(--muted) leading-relaxed max-w-[75ch]">
          Il CAPE misura quanto è cara la borsa rispetto agli utili medi degli ultimi 10 anni. Oggi è più alto del{' '}
          {evidence.capePctAll}% dei mesi dal {evidence.firstYear + 10} e del {evidence.capePct30y}% degli ultimi 30 anni
          (valore tipico storico: {fmtNum(evidence.capeMedianAll)}; ultimi 30 anni: {fmtNum(evidence.capeMedian30y)}).
          Per ogni fascia, la barra mostra quanto ha reso la borsa <strong className="text-(--ink)">nei 10 anni successivi</strong>:
          la tacca è il caso tipico, la barra copre 8 casi su 10.
        </p>
        <div>
          <div className="grid grid-cols-[5.5rem_1fr_4.5rem] sm:grid-cols-[7rem_1fr_5rem_6.5rem] gap-3 px-3 pb-1 text-xs font-medium text-(--muted)">
            <span>CAPE</span>
            <span className="flex justify-between"><span>{LO}%</span><span>rendimento annuo nei 10 anni dopo</span><span>+{HI}%</span></span>
            <span className="text-right">Tipico</span>
            <span className="hidden sm:block text-right">Esito</span>
          </div>
          <ul className="space-y-0.5">
            {evidence.buckets.map((b) => <BucketRow key={b.label} b={b} />)}
          </ul>
        </div>
        {current && current.episodes <= 12 && (
          <p className="text-xs text-(--warning-text) bg-(--warning-subtle) rounded-lg px-3 py-2 leading-relaxed">
            Attenzione a non leggere troppo nella riga evidenziata: valutazioni così alte si sono viste in soli{' '}
            {current.episodes} anni diversi su {totalYears}, quasi tutti a cavallo della bolla del 2000. I precedenti sono
            pochi e il dato va preso come indicazione di massima.
          </p>
        )}
        {evidence.ecy !== null && evidence.ecyPct30y !== null && (
          <p className="text-xs text-(--muted) leading-relaxed max-w-[75ch]">
            Rispetto alle obbligazioni: gli utili delle azioni USA rendono oggi {fmtNum(evidence.ecy)} punti percentuali in
            più di un titolo di Stato a 10 anni al netto dell’inflazione. Negli ultimi 30 anni questo margine è stato più
            alto di così nel {100 - evidence.ecyPct30y}% dei mesi.
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 2 — Orizzonte */}
        <Card className="space-y-3">
          <h3 className="text-base font-semibold text-(--ink)">Il tempo conta più del momento</h3>
          <p className="text-sm text-(--muted) leading-relaxed">
            Con che frequenza chi ha investito in borsa si è ritrovato, alla fine, con meno potere d’acquisto di quando
            era partito — in base a quanto a lungo è rimasto investito.
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-xs font-medium text-(--muted)">
                <th scope="col" className="py-1.5 text-left">Durata</th>
                <th scope="col" className="py-1.5 text-right">In perdita</th>
                <th scope="col" className="py-1.5 text-right">Tipico</th>
                <th scope="col" className="py-1.5 text-right hidden sm:table-cell">Peggiore</th>
                <th scope="col" className="py-1.5 text-right hidden sm:table-cell">Migliore</th>
              </tr>
            </thead>
            <tbody>
              {evidence.holding.map((h) => (
                <tr key={h.years} className="border-t border-(--border)">
                  <th scope="row" className="py-2 text-left font-normal text-(--ink)">{h.years} {h.years === 1 ? 'anno' : 'anni'}</th>
                  <td className="py-2 text-right font-mono tabular-nums text-(--ink)">{pctCases(h, h.worst)}</td>
                  <td className={`py-2 text-right font-mono tabular-nums ${toneClass(h.median)}`}>{fmtSignedPct(h.median)}</td>
                  <td className={`py-2 text-right font-mono tabular-nums hidden sm:table-cell ${toneClass(h.worst)}`}>{fmtSignedPct(h.worst)}</td>
                  <td className={`py-2 text-right font-mono tabular-nums hidden sm:table-cell ${toneClass(h.best)}`}>{fmtSignedPct(h.best)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-(--muted)">«In perdita» = quota dei periodi chiusi sotto il valore reale di partenza. Rendimenti annui.</p>
        </Card>

        {/* 3 — Massimi */}
        <Card className="space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h3 className="text-base font-semibold text-(--ink)">E se si investe sui massimi?</h3>
            {evidence.nearHighNow && <Badge variant="warning">Oggi la borsa USA è sui massimi</Badge>}
          </div>
          <p className="text-sm text-(--muted) leading-relaxed">
            Confronto tra chi è entrato quando la borsa era entro il 2% dal suo massimo di sempre e chi è entrato in
            qualsiasi altro momento.
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-xs font-medium text-(--muted)">
                <th scope="col" className="py-1.5 text-left">Dopo</th>
                <th scope="col" className="py-1.5 text-right" colSpan={2}>Sui massimi</th>
                <th scope="col" className="py-1.5 text-right" colSpan={2}>Altri momenti</th>
              </tr>
            </thead>
            <tbody>
              {evidence.highs.map((h) => (
                <tr key={h.years} className="border-t border-(--border)">
                  <th scope="row" className="py-2 text-left font-normal text-(--ink)">{h.years} {h.years === 1 ? 'anno' : 'anni'}</th>
                  <td className={`py-2 text-right font-mono tabular-nums ${toneClass(h.nearHigh.median)}`}>{fmtSignedPct(h.nearHigh.median)}</td>
                  <td className="py-2 pl-2 text-right text-xs font-mono tabular-nums text-(--muted)">{h.nearHigh.pctNegative}% in perdita</td>
                  <td className={`py-2 text-right font-mono tabular-nums ${toneClass(h.other.median)}`}>{fmtSignedPct(h.other.median)}</td>
                  <td className="py-2 pl-2 text-right text-xs font-mono tabular-nums text-(--muted)">{h.other.pctNegative}% in perdita</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tenYearHigh && (
            <p className="text-xs text-(--muted) leading-relaxed">
              A 10 anni il rendimento tipico è stato {fmtSignedPct(tenYearHigh.nearHigh.median)} l’anno per chi è entrato
              sui massimi e {fmtSignedPct(tenYearHigh.other.median)} per gli altri; i casi chiusi in perdita sono stati
              rispettivamente il {tenYearHigh.nearHigh.pctNegative}% e il {tenYearHigh.other.pctNegative}%.
            </p>
          )}
        </Card>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-(--muted) flex-wrap">
        <SourceLink source="Robert Shiller (Yale)" />
        <span>indice S&amp;P Composite, dati mensili {evidence.firstYear}–{evidence.asOf.slice(0, 4)}</span>
      </div>
    </div>
  )
}
