'use client'
import { useActionState, useState, useTransition } from 'react'
import { addTxnAction, lookupIsinAction, fetchInstrumentDetailsAction, type ActionState } from './actions'
import type { IsinResult } from '@/lib/isin'

const CLUSTER_LABELS: Record<string, string> = {
  etf: 'ETF', bond: 'Obbligazione/BTP', stock: 'Azione', crypto: 'Cripto', other: 'Altro',
}
const SOURCE_LABELS: Record<string, string> = {
  yahoo: 'Yahoo Finance', coingecko: 'CoinGecko', alphavantage: 'Alpha Vantage', manual: 'Manuale',
}

interface InstrFields {
  isin:         string
  symbol:       string
  name:         string
  cluster:      string
  currency:     string
  price_source: string
  ter:          string
}
const EMPTY: InstrFields = {
  isin: '', symbol: '', name: '', cluster: 'etf', currency: 'EUR', price_source: 'yahoo', ter: '',
}

export default function AddTxnForm({ portfolioId }: { portfolioId: number }) {
  const [open, setOpen]           = useState(false)
  const [type, setType]           = useState<'buy' | 'sell' | 'dividend' | 'fee'>('buy')
  const [instr, setInstr]         = useState<InstrFields>(EMPTY)
  const [unitPrice, setUnitPrice] = useState('')
  const [hits, setHits]           = useState<IsinResult[]>([])
  const [lookupErr, setLookupErr] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)

  // Solo ISIN lookup usa useTransition (chiamata di rete separata).
  // fetchDetails è una funzione async normale per evitare transizioni annidate.
  const [isLooking, startLookup] = useTransition()

  const boundAction = addTxnAction.bind(null, portfolioId)
  const [state, action, pending] = useActionState<ActionState, FormData>(boundAction, undefined)

  const isBuySell  = type === 'buy' || type === 'sell'
  const isDivOrFee = type === 'dividend' || type === 'fee'

  function setField(key: keyof InstrFields) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setInstr((p) => ({ ...p, [key]: e.target.value }))
  }

  async function fetchDetails(symbol: string) {
    if (!symbol || isFetching) return
    setIsFetching(true)
    try {
      const det = await fetchInstrumentDetailsAction(symbol)
      if (det.price)    setUnitPrice(det.price)
      if (det.currency) setInstr((p) => ({ ...p, currency: det.currency! }))
      if (det.ter)      setInstr((p) => ({ ...p, ter: det.ter! }))
    } finally {
      setIsFetching(false)
    }
  }

  function applyResult(r: IsinResult) {
    setInstr((p) => ({
      ...p,
      symbol:       r.yahooSymbol,
      name:         r.name,
      cluster:      r.cluster,
      price_source: r.priceSource,
    }))
    setHits([])
    // fetchDetails è async normale — nessun problema di transizioni annidate
    fetchDetails(r.yahooSymbol)
  }

  function handleLookup() {
    const isin = instr.isin.trim()
    if (!isin) return
    setLookupErr(null)
    setHits([])
    startLookup(async () => {
      const results = await lookupIsinAction(isin)
      if (results.length === 0) {
        setLookupErr('Nessuno strumento trovato per questo ISIN.')
      } else if (results.length === 1) {
        applyResult(results[0])
      } else {
        setHits(results)
      }
    })
  }

  function handleClose() {
    setOpen(false)
    setInstr(EMPTY)
    setUnitPrice('')
    setHits([])
    setLookupErr(null)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-emerald-500 text-zinc-950 font-medium px-4 py-2 text-sm hover:bg-emerald-400 transition"
      >
        + Aggiungi operazione
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">Nuova operazione</h3>
        <button onClick={handleClose} className="text-zinc-500 hover:text-zinc-300 text-sm transition">✕</button>
      </div>

      <form action={action} className="space-y-5">

        {/* ── ISIN lookup ─────────────────────────────────────────────────── */}
        <div className="rounded-lg border border-zinc-700/60 bg-zinc-950/40 p-4 space-y-3">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Cerca per ISIN (opzionale)</p>
          <div className="flex gap-2">
            <input
              value={instr.isin}
              onChange={setField('isin')}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLookup())}
              placeholder="es. IE00B3RBWM25"
              maxLength={12}
              className="flex-1 rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100
                         placeholder:text-zinc-600 focus:border-emerald-500 outline-none font-mono uppercase tracking-widest"
            />
            <button
              type="button"
              onClick={handleLookup}
              disabled={isLooking || !instr.isin.trim()}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300
                         hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-40 transition whitespace-nowrap"
            >
              {isLooking ? 'Cerco…' : 'Cerca'}
            </button>
          </div>

          {lookupErr && <p className="text-xs text-amber-400">{lookupErr}</p>}

          {hits.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-500">Trovate {hits.length} quotazioni — scegli la borsa:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {hits.map((r) => (
                  <button
                    key={r.figi}
                    type="button"
                    onClick={() => applyResult(r)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-left
                               hover:border-emerald-500 hover:bg-zinc-800 transition"
                  >
                    <p className="text-sm font-mono font-medium text-zinc-100">{r.yahooSymbol}</p>
                    <p className="text-xs text-zinc-500">{r.exchLabel} · {r.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Tipo + data ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Tipo</label>
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 outline-none"
            >
              <option value="buy">Acquisto</option>
              <option value="sell">Vendita</option>
              <option value="dividend">Dividendo</option>
              <option value="fee">Commissione</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Data</label>
            <input
              type="date"
              name="trade_date"
              required
              className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        <input type="hidden" name="isin" value={instr.isin} />

        {/* ── Strumento (auto-filled da ISIN) ──────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Simbolo (ticker)</label>
            <input
              name="symbol"
              value={instr.symbol}
              onChange={setField('symbol')}
              required
              placeholder="es. VWCE.DE"
              className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100
                         placeholder:text-zinc-600 focus:border-emerald-500 outline-none uppercase"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Nome strumento</label>
            <input
              name="instrument_name"
              value={instr.name}
              onChange={setField('name')}
              required
              placeholder="es. Vanguard FTSE All-World"
              className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100
                         placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Tipo strumento</label>
            <select
              name="cluster"
              value={instr.cluster}
              onChange={setField('cluster')}
              className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 outline-none"
            >
              {Object.entries(CLUSTER_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Valuta</label>
            <input
              name="currency"
              value={instr.currency}
              onChange={setField('currency')}
              maxLength={3}
              required
              className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100
                         focus:border-emerald-500 outline-none uppercase"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Fonte prezzo</label>
            <select
              name="price_source"
              value={instr.price_source}
              onChange={setField('price_source')}
              className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 outline-none"
            >
              {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">TER % / anno</label>
            <input
              name="ter"
              value={instr.ter}
              onChange={setField('ter')}
              placeholder="es. 0.22"
              className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100
                         placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* ── Campi buy/sell ────────────────────────────────────────────────── */}
        {isBuySell && (
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Quantità</label>
              <input
                name="quantity"
                required
                placeholder="es. 10"
                className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100
                           placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-zinc-500">
                  Prezzo unitario
                  {isFetching && <span className="ml-1 text-zinc-600 animate-pulse">aggiorno…</span>}
                </label>
                {!isFetching && instr.symbol && (
                  <button
                    type="button"
                    onClick={() => fetchDetails(instr.symbol)}
                    className="text-xs text-zinc-600 hover:text-emerald-400 transition"
                    title="Ricarica prezzo corrente da Yahoo Finance"
                  >
                    ↻ aggiorna
                  </button>
                )}
              </div>
              <input
                name="unit_price"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
                placeholder="es. 95.42"
                className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100
                           placeholder:text-zinc-600 focus:border-emerald-500 outline-none font-mono"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Commissione</label>
              <input
                name="fee"
                placeholder="es. 4.95"
                className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100
                           placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* ── Importo dividend/fee ─────────────────────────────────────────── */}
        {isDivOrFee && (
          <div className="flex flex-col gap-1 max-w-xs">
            <label className="text-xs text-zinc-500">
              {type === 'dividend' ? 'Importo dividendo' : 'Importo commissione'}
            </label>
            <input
              name="amount"
              required
              placeholder="es. 12.50"
              className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100
                         placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Nota (opzionale)</label>
          <input
            name="note"
            className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100
                       placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-emerald-500 text-zinc-950 font-medium px-5 py-2 text-sm hover:bg-emerald-400 disabled:opacity-50 transition"
          >
            {pending ? 'Salvo…' : 'Salva operazione'}
          </button>
          <button type="button" onClick={handleClose} className="text-sm text-zinc-500 hover:text-zinc-300 transition">
            Annulla
          </button>
        </div>

        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      </form>
    </div>
  )
}
