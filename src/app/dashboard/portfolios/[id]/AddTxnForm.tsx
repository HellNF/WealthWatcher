'use client'
import { useActionState, useState } from 'react'
import { addTxnAction, type ActionState } from './actions'

const CLUSTER_LABELS: Record<string, string> = {
  etf: 'ETF', bond: 'Obbligazione/BTP', stock: 'Azione', crypto: 'Cripto', other: 'Altro',
}
const SOURCE_LABELS: Record<string, string> = {
  yahoo: 'Yahoo Finance', coingecko: 'CoinGecko', alphavantage: 'Alpha Vantage', manual: 'Manuale',
}

export default function AddTxnForm({ portfolioId }: { portfolioId: number }) {
  const [open, setOpen]       = useState(false)
  const [type, setType]       = useState<'buy' | 'sell' | 'dividend' | 'fee'>('buy')
  const boundAction = addTxnAction.bind(null, portfolioId)
  const [state, action, pending] = useActionState<ActionState, FormData>(boundAction, undefined)

  const isBuySell   = type === 'buy' || type === 'sell'
  const isDivOrFee  = type === 'dividend' || type === 'fee'

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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-300">Nuova operazione</h3>
        <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300 text-sm transition">
          ✕
        </button>
      </div>

      <form action={action} className="space-y-4">
        {/* Type + date */}
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

        {/* Instrument */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Simbolo (ticker)</label>
            <input
              name="symbol"
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
              required
              placeholder="es. Vanguard FTSE All-World"
              className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100
                         placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Tipo strumento</label>
            <select
              name="cluster"
              defaultValue="etf"
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
              defaultValue="EUR"
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
              defaultValue="yahoo"
              className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 outline-none"
            >
              {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Buy/Sell fields */}
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
              <label className="text-xs text-zinc-500">Prezzo unitario</label>
              <input
                name="unit_price"
                required
                placeholder="es. 95.42"
                className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100
                           placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
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

        {/* Dividend/fee amount */}
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

        {/* Note */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Nota (opzionale)</label>
          <input
            name="note"
            placeholder=""
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
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition"
          >
            Annulla
          </button>
        </div>

        {state?.error && (
          <p className="text-sm text-red-400">{state.error}</p>
        )}
      </form>
    </div>
  )
}
