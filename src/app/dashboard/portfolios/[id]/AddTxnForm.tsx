'use client'
import { useActionState, useState, useTransition, useRef } from 'react'
import { addTxnAction, lookupIsinAction, fetchInstrumentDetailsAction,
         extractKidAction, confirmKidAction,
         type ActionState, type KidActionState, type ConfirmKidState } from './actions'
import type { IsinResult } from '@/lib/isin'
import type { KidExtraction } from '@/lib/kid/extract'

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

// KID review state: fields that the user can edit after extraction
interface KidReview {
  name:       string
  ter:        string
  entry_cost: string
  exit_cost:  string
  sri:        string
}

function kidToReview(d: KidExtraction): KidReview {
  return {
    name:       d.name.value ?? '',
    ter:        d.ter.value != null ? String(d.ter.value) : '',
    entry_cost: d.entry_cost.value != null ? String(d.entry_cost.value) : '',
    exit_cost:  d.exit_cost.value != null ? String(d.exit_cost.value) : '',
    sri:        d.sri.value != null ? String(d.sri.value) : '',
  }
}

function confidenceBadge(c: 'low' | 'medium' | 'high') {
  const cls = c === 'high' ? 'text-emerald-400 bg-emerald-950' :
              c === 'medium' ? 'text-amber-400 bg-amber-950' :
              'text-red-400 bg-red-950'
  return <span className={`text-xs px-1.5 py-0.5 rounded ${cls}`}>{c}</span>
}

export default function AddTxnForm({ portfolioId }: { portfolioId: number }) {
  const [open, setOpen]           = useState(false)
  const [type, setType]           = useState<'buy' | 'sell' | 'dividend' | 'fee'>('buy')
  const [instr, setInstr]         = useState<InstrFields>(EMPTY)
  const [unitPrice, setUnitPrice] = useState('')
  const [hits, setHits]           = useState<IsinResult[]>([])
  const [lookupErr, setLookupErr] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [fetchMsg, setFetchMsg]     = useState<string | null>(null)

  // KID extraction state
  const [kidExtracted, setKidExtracted] = useState<KidExtraction | null>(null)
  const [kidModel, setKidModel]         = useState<string>('')
  const [kidFilename, setKidFilename]   = useState<string>('')
  const [kidReview, setKidReview]       = useState<KidReview | null>(null)
  const [kidPending, setKidPending]     = useState(false)
  const [kidErr, setKidErr]             = useState<string | null>(null)
  const kidFileRef = useRef<HTMLInputElement>(null)

  const [confirmKidState, confirmAction, confirmPending] =
    useActionState<ConfirmKidState, FormData>(confirmKidAction, undefined)

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
    setFetchMsg(null)
    try {
      const det = await fetchInstrumentDetailsAction(symbol)
      if (det.price)    setUnitPrice(det.price)
      if (det.currency) setInstr((p) => ({ ...p, currency: det.currency! }))
      if (det.ter)      setInstr((p) => ({ ...p, ter: det.ter! }))
      if (!det.price)   setFetchMsg('Prezzo non disponibile — inseriscilo manualmente.')
    } catch {
      setFetchMsg('Errore nel recupero del prezzo.')
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

  async function handleKidUpload(file: File) {
    setKidErr(null)
    setKidExtracted(null)
    setKidReview(null)
    setKidPending(true)
    try {
      const fd = new FormData()
      fd.append('kid_pdf', file)
      const result = await extractKidAction(undefined, fd) as KidActionState
      if (!result) return
      if ('error' in result) { setKidErr(result.error); return }
      setKidExtracted(result.data)
      setKidModel(result.model)
      setKidFilename(file.name)
      setKidReview(kidToReview(result.data))
    } finally {
      setKidPending(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setInstr(EMPTY)
    setUnitPrice('')
    setHits([])
    setLookupErr(null)
    setFetchMsg(null)
    setKidExtracted(null)
    setKidReview(null)
    setKidErr(null)
    if (kidFileRef.current) kidFileRef.current.value = ''
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
            <div className="space-y-2">
              <div>
                <p className="text-xs text-zinc-400 font-medium">
                  Lo stesso ETF/strumento è quotato su {hits.length} borse — scegli quella su cui hai comprato:
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Per un broker italiano tipicamente Borsa Italiana o Xetra.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {hits.map((r) => (
                  <button
                    key={r.figi}
                    type="button"
                    onClick={() => applyResult(r)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-left
                               hover:border-emerald-500 hover:bg-zinc-800 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-mono font-semibold text-zinc-100 group-hover:text-emerald-400 transition">
                        {r.yahooSymbol}
                      </p>
                      {(r.exchCode === 'IM' || r.exchCode === 'GY') && (
                        <span className="text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-800 rounded px-1.5 py-0.5">
                          consigliato
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{r.exchLabel}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── KID import ──────────────────────────────────────────────────── */}
        <div className="rounded-lg border border-zinc-700/60 bg-zinc-950/40 p-4 space-y-3">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Importa dati da KID (opzionale)</p>

          {!kidExtracted ? (
            <div className="flex items-center gap-3">
              <label className={`cursor-pointer rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300
                hover:border-zinc-500 hover:text-zinc-100 transition ${kidPending ? 'opacity-50 pointer-events-none' : ''}`}>
                {kidPending ? 'Estrazione in corso…' : '↑ Carica PDF KID'}
                <input
                  ref={kidFileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleKidUpload(f) }}
                />
              </label>
              {kidErr && <p className="text-xs text-red-400">{kidErr}</p>}
            </div>
          ) : (
            /* Review panel */
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Campi estratti da <span className="font-mono text-zinc-300">{kidFilename}</span> via <span className="text-zinc-500">{kidModel}</span>.
                Verifica e correggi prima di confermare.
              </p>

              {/* Hidden fields for audit */}
              <input type="hidden" name="filename" value={kidFilename} form="kid-confirm-form" />
              <input type="hidden" name="model" value={kidModel} form="kid-confirm-form" />
              <input type="hidden" name="extracted_json" value={JSON.stringify(kidExtracted)} form="kid-confirm-form" />
              <input type="hidden" name="symbol" value={instr.symbol} form="kid-confirm-form" />
              <input type="hidden" name="instr_name" value={instr.name} form="kid-confirm-form" />
              <input type="hidden" name="cluster" value={instr.cluster} form="kid-confirm-form" />
              <input type="hidden" name="currency" value={instr.currency} form="kid-confirm-form" />

              <div className="grid grid-cols-2 gap-3">
                {/* Name */}
                <div className="flex flex-col gap-1 col-span-2">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-zinc-500">Nome strumento</label>
                    {confidenceBadge(kidExtracted.name.confidence)}
                  </div>
                  <input
                    name="name" form="kid-confirm-form"
                    value={kidReview!.name}
                    onChange={e => setKidReview(r => r ? { ...r, name: e.target.value } : r)}
                    className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 outline-none"
                  />
                </div>

                {/* TER */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-zinc-500">TER % / anno</label>
                    {kidExtracted.ter.value != null && confidenceBadge(kidExtracted.ter.confidence)}
                  </div>
                  <input
                    name="ter" form="kid-confirm-form"
                    value={kidReview!.ter}
                    onChange={e => setKidReview(r => r ? { ...r, ter: e.target.value } : r)}
                    placeholder="es. 0.20"
                    className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
                  />
                </div>

                {/* SRI */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-zinc-500">SRI (rischio 1–7)</label>
                    {kidExtracted.sri.value != null && confidenceBadge(kidExtracted.sri.confidence)}
                  </div>
                  <input
                    name="sri" form="kid-confirm-form"
                    type="number" min="1" max="7"
                    value={kidReview!.sri}
                    onChange={e => setKidReview(r => r ? { ...r, sri: e.target.value } : r)}
                    placeholder="4"
                    className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
                  />
                </div>

                {/* Entry cost */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-zinc-500">Costo ingresso %</label>
                    {kidExtracted.entry_cost.value != null && confidenceBadge(kidExtracted.entry_cost.confidence)}
                  </div>
                  <input
                    name="entry_cost" form="kid-confirm-form"
                    value={kidReview!.entry_cost}
                    onChange={e => setKidReview(r => r ? { ...r, entry_cost: e.target.value } : r)}
                    placeholder="es. 3.0"
                    className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
                  />
                </div>

                {/* Exit cost */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-zinc-500">Costo uscita %</label>
                    {kidExtracted.exit_cost.value != null && confidenceBadge(kidExtracted.exit_cost.confidence)}
                  </div>
                  <input
                    name="exit_cost" form="kid-confirm-form"
                    value={kidReview!.exit_cost}
                    onChange={e => setKidReview(r => r ? { ...r, exit_cost: e.target.value } : r)}
                    placeholder="es. 0"
                    className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              {/* Benchmark + taxation note (read-only, informational) */}
              {kidExtracted.benchmark.value && (
                <p className="text-xs text-zinc-500">
                  Benchmark: <span className="text-zinc-400">{kidExtracted.benchmark.value}</span>
                  {' '}{confidenceBadge(kidExtracted.benchmark.confidence)}
                </p>
              )}
              {kidExtracted.taxation_note.value && (
                <p className="text-xs text-zinc-500">
                  Fiscalità: <span className="text-zinc-400">{kidExtracted.taxation_note.value}</span>
                </p>
              )}

              <form id="kid-confirm-form" action={confirmAction} className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={confirmPending || !instr.symbol}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium disabled:opacity-50 transition"
                >
                  {confirmPending ? 'Salvo…' : 'Conferma dati KID'}
                </button>
                <button
                  type="button"
                  onClick={() => { setKidExtracted(null); setKidReview(null); setKidErr(null); if (kidFileRef.current) kidFileRef.current.value = '' }}
                  className="text-sm text-zinc-500 hover:text-zinc-300 transition"
                >
                  Annulla
                </button>
                {!instr.symbol && <p className="text-xs text-amber-400">Compila prima il simbolo strumento</p>}
              </form>

              {confirmKidState?.error   && <p className="text-sm text-red-400">{confirmKidState.error}</p>}
              {confirmKidState?.success && <p className="text-sm text-emerald-400">{confirmKidState.success}</p>}
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
              {fetchMsg && <p className="text-xs text-amber-400 mt-1">{fetchMsg}</p>}
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
