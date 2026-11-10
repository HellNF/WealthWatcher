import type { Position } from '@/lib/positions'
import { summarizePriceQuality } from '@/lib/prices/quality'
import { formatDateTimeIt } from '@/lib/formatDate'
function date(at: number) { return formatDateTimeIt(at, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
export function PriceQuality({ position: p }: { position: Position }) {
  return <span className="block text-xs text-(--muted)">
    {!p.lastPrice ? 'Prezzo non disponibile' : `${p.priceKind === 'close' ? 'Chiusura giornaliera' : p.priceKind === 'manual' ? 'Valore manuale' : 'Ultima quotazione disponibile'} · ${p.priceSource ?? 'Origine storica non verificata'}`}
    {p.priceRetrievedAt && <span className="block">Acquisito: {date(p.priceRetrievedAt)}</span>}
  </span>
}
export function PortfolioQuality({ positions }: { positions: Position[] }) {
  const q = summarizePriceQuality(positions)
  return <ValuationQuality quality={q} />
}
export function ValuationQuality({ quality: q }: { quality: ReturnType<typeof summarizePriceQuality> }) {
  if (!q.total) return null
  return <details className="text-xs text-(--muted)">
    <summary className="cursor-pointer">{q.missing ? `Valutazione incompleta: ${q.missing} prezzi mancanti` : q.aged || q.legacy ? 'Valutazione da verificare' : 'Prezzi disponibili'} · Dettaglio dati</summary>
    <p className="mt-2">{q.total - q.missing}/{q.total} posizioni con prezzo e data. Fonti: {q.sources.join(', ') || 'nessuna'}.</p>
    {q.oldest && <p>Rilevazioni dal {date(q.oldest)} al {date(q.newest!)}.</p>}
    {q.aged > 0 && <p>{q.aged} prezzi hanno più di 24 ore. Festività e chiusure di borsa possono spiegare l’età del dato; il calendario della borsa non è verificato.</p>}
    {q.legacy > 0 && <p>{q.legacy} prezzi storici senza provenienza verificata. Aggiorna i prezzi per registrarne la fonte.</p>}
  </details>
}
