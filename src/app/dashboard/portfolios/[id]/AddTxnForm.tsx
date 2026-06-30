'use client'
import { useActionState, useState, useTransition, useRef } from 'react'
import { X, RefreshCw, Search, Upload } from 'lucide-react'
import {
  addTxnAction, lookupIsinAction, fetchInstrumentDetailsAction,
  extractKidAction, confirmKidAction,
  type ActionState, type KidActionState, type ConfirmKidState,
} from './actions'
import type { IsinResult } from '@/lib/isin'
import type { KidExtraction } from '@/lib/kid/extract'
import { Button, Field, Input, Select, Badge, Card, CardHeader, CardTitle } from '@/components/ui'
import { cn } from '@/lib/cn'

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

interface KidReview {
  name: string; ter: string; entry_cost: string; exit_cost: string; sri: string
}

function kidToReview(d: KidExtraction): KidReview {
  return {
    name:       d.name.value ?? '',
    ter:        d.ter.value        != null ? String(d.ter.value)        : '',
    entry_cost: d.entry_cost.value != null ? String(d.entry_cost.value) : '',
    exit_cost:  d.exit_cost.value  != null ? String(d.exit_cost.value)  : '',
    sri:        d.sri.value        != null ? String(d.sri.value)        : '',
  }
}

function ConfidenceBadge({ c }: { c: 'low' | 'medium' | 'high' }) {
  return (
    <Badge variant={c === 'high' ? 'success' : c === 'medium' ? 'warning' : 'danger'}>
      {c}
    </Badge>
  )
}

// Classe comune per sezioni disclosure
const sectionCls = 'rounded-xl border border-[--border] bg-[--surface-2] p-4 space-y-3'

export default function AddTxnForm({ portfolioId }: { portfolioId: number }) {
  const [open, setOpen]               = useState(false)
  const [type, setType]               = useState<'buy' | 'sell' | 'dividend' | 'fee'>('buy')
  const [instr, setInstr]             = useState<InstrFields>(EMPTY)
  const [unitPrice, setUnitPrice]     = useState('')
  const [hits, setHits]               = useState<IsinResult[]>([])
  const [lookupErr, setLookupErr]     = useState<string | null>(null)
  const [isFetching, setIsFetching]   = useState(false)
  const [fetchMsg, setFetchMsg]       = useState<string | null>(null)

  const [kidExtracted, setKidExtracted] = useState<KidExtraction | null>(null)
  const [kidModel, setKidModel]         = useState<string>('')
  const [kidFilename, setKidFilename]   = useState<string>('')
  const [kidReview, setKidReview]       = useState<KidReview | null>(null)
  const [kidPending, setKidPending]     = useState(false)
  const [kidErr, setKidErr]             = useState<string | null>(null)
  const kidFileRef = useRef<HTMLInputElement>(null)

  const [confirmKidState, confirmAction, confirmPending] =
    useActionState<ConfirmKidState, FormData>(confirmKidAction, undefined)

  const [isLooking, startLookup] = useTransition()

  const boundAction = addTxnAction.bind(null, portfolioId)
  const [state, action, pending] = useActionState<ActionState, FormData>(boundAction, undefined)

  const isBuySell  = type === 'buy'  || type === 'sell'
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
    setInstr((p) => ({ ...p, symbol: r.yahooSymbol, name: r.name, cluster: r.cluster, price_source: r.priceSource }))
    setHits([])
    fetchDetails(r.yahooSymbol)
  }

  function handleLookup() {
    const isin = instr.isin.trim()
    if (!isin) return
    setLookupErr(null)
    setHits([])
    startLookup(async () => {
      const results = await lookupIsinAction(isin)
      if (results.length === 0) setLookupErr('Nessuno strumento trovato per questo ISIN.')
      else if (results.length === 1) applyResult(results[0])
      else setHits(results)
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
      <Button onClick={() => setOpen(true)}>
        + Aggiungi operazione
      </Button>
    )
  }

  return (
    <Card className="space-y-5">
      <CardHeader>
        <CardTitle as="h3">Nuova operazione</CardTitle>
        <button
          onClick={handleClose}
          className="text-[--faint] hover:text-[--ink] transition-colors"
          aria-label="Chiudi"
        >
          <X className="size-4" />
        </button>
      </CardHeader>

      <form action={action} className="space-y-5">

        {/* ── ISIN lookup ──────────────────────────────────────────────────── */}
        <div className={sectionCls}>
          <p className="text-xs font-medium text-[--muted]">Cerca per ISIN (opzionale)</p>
          <div className="flex gap-2">
            <Input
              value={instr.isin}
              onChange={setField('isin')}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLookup())}
              placeholder="es. IE00B3RBWM25"
              maxLength={12}
              className="flex-1 font-mono uppercase tracking-widest"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleLookup}
              disabled={isLooking || !instr.isin.trim()}
              loading={isLooking}
            >
              <Search className="size-4" />
              Cerca
            </Button>
          </div>

          {lookupErr && <p className="text-xs text-[--warning]">{lookupErr}</p>}

          {hits.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-[--muted]">
                Lo stesso strumento è quotato su {hits.length} borse — scegli quella su cui hai comprato:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {hits.map((r) => (
                  <button
                    key={r.figi}
                    type="button"
                    onClick={() => applyResult(r)}
                    className={cn(
                      'rounded-lg border border-[--border] bg-[--surface] px-3 py-2.5 text-left',
                      'hover:border-[--brand] hover:bg-[--brand-subtle] transition-colors duration-100 group',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-mono font-semibold text-[--ink] group-hover:text-[--brand] transition-colors">
                        {r.yahooSymbol}
                      </p>
                      {(r.exchCode === 'IM' || r.exchCode === 'GY') && (
                        <Badge variant="success">consigliato</Badge>
                      )}
                    </div>
                    <p className="text-xs text-[--muted] mt-0.5">{r.exchLabel}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── KID import ───────────────────────────────────────────────────── */}
        <div className={sectionCls}>
          <p className="text-xs font-medium text-[--muted]">Importa dati da KID (opzionale)</p>

          {!kidExtracted ? (
            <div className="flex items-center gap-3">
              <label className={cn(
                'inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-[--border]',
                'text-sm text-[--ink] cursor-pointer hover:bg-[--surface] transition-colors duration-100',
                kidPending && 'opacity-50 pointer-events-none',
              )}>
                <Upload className="size-4 text-[--muted]" />
                {kidPending ? 'Estrazione in corso…' : 'Carica PDF KID'}
                <input
                  ref={kidFileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleKidUpload(f) }}
                />
              </label>
              {kidErr && <p className="text-xs text-[--danger]">{kidErr}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-[--muted]">
                Campi estratti da{' '}
                <span className="font-mono text-[--ink]">{kidFilename}</span>{' '}
                via <span className="text-[--faint]">{kidModel}</span>.
                Verifica e correggi prima di confermare.
              </p>

              {/* Hidden fields for audit — associati a kid-confirm-form */}
              <input type="hidden" name="filename"       value={kidFilename}                   form="kid-confirm-form" />
              <input type="hidden" name="model"          value={kidModel}                      form="kid-confirm-form" />
              <input type="hidden" name="extracted_json" value={JSON.stringify(kidExtracted)}  form="kid-confirm-form" />
              <input type="hidden" name="symbol"         value={instr.symbol}                  form="kid-confirm-form" />
              <input type="hidden" name="instr_name"     value={instr.name}                    form="kid-confirm-form" />
              <input type="hidden" name="cluster"        value={instr.cluster}                 form="kid-confirm-form" />
              <input type="hidden" name="currency"       value={instr.currency}                form="kid-confirm-form" />

              <div className="grid grid-cols-2 gap-3">
                {/* Name */}
                <Field
                  label="Nome strumento"
                  htmlFor="kid-name"
                  className="col-span-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ConfidenceBadge c={kidExtracted.name.confidence} />
                  </div>
                  <Input
                    id="kid-name"
                    name="name"
                    form="kid-confirm-form"
                    value={kidReview!.name}
                    onChange={e => setKidReview(r => r ? { ...r, name: e.target.value } : r)}
                  />
                </Field>

                {/* TER */}
                <Field label="TER % / anno" htmlFor="kid-ter">
                  {kidExtracted.ter.value != null && (
                    <div className="flex items-center gap-2 mb-1">
                      <ConfidenceBadge c={kidExtracted.ter.confidence} />
                    </div>
                  )}
                  <Input
                    id="kid-ter"
                    name="ter"
                    form="kid-confirm-form"
                    value={kidReview!.ter}
                    onChange={e => setKidReview(r => r ? { ...r, ter: e.target.value } : r)}
                    placeholder="es. 0.20"
                  />
                </Field>

                {/* SRI */}
                <Field label="SRI (rischio 1–7)" htmlFor="kid-sri">
                  {kidExtracted.sri.value != null && (
                    <div className="flex items-center gap-2 mb-1">
                      <ConfidenceBadge c={kidExtracted.sri.confidence} />
                    </div>
                  )}
                  <Input
                    id="kid-sri"
                    name="sri"
                    form="kid-confirm-form"
                    type="number"
                    min="1"
                    max="7"
                    value={kidReview!.sri}
                    onChange={e => setKidReview(r => r ? { ...r, sri: e.target.value } : r)}
                    placeholder="4"
                  />
                </Field>

                {/* Entry cost */}
                <Field label="Costo ingresso %" htmlFor="kid-entry">
                  {kidExtracted.entry_cost.value != null && (
                    <div className="flex items-center gap-2 mb-1">
                      <ConfidenceBadge c={kidExtracted.entry_cost.confidence} />
                    </div>
                  )}
                  <Input
                    id="kid-entry"
                    name="entry_cost"
                    form="kid-confirm-form"
                    value={kidReview!.entry_cost}
                    onChange={e => setKidReview(r => r ? { ...r, entry_cost: e.target.value } : r)}
                    placeholder="es. 3.0"
                  />
                </Field>

                {/* Exit cost */}
                <Field label="Costo uscita %" htmlFor="kid-exit">
                  {kidExtracted.exit_cost.value != null && (
                    <div className="flex items-center gap-2 mb-1">
                      <ConfidenceBadge c={kidExtracted.exit_cost.confidence} />
                    </div>
                  )}
                  <Input
                    id="kid-exit"
                    name="exit_cost"
                    form="kid-confirm-form"
                    value={kidReview!.exit_cost}
                    onChange={e => setKidReview(r => r ? { ...r, exit_cost: e.target.value } : r)}
                    placeholder="es. 0"
                  />
                </Field>
              </div>

              {kidExtracted.benchmark.value && (
                <p className="text-xs text-[--muted]">
                  Benchmark: <span className="text-[--ink]">{kidExtracted.benchmark.value}</span>
                  {' '}<ConfidenceBadge c={kidExtracted.benchmark.confidence} />
                </p>
              )}
              {kidExtracted.taxation_note.value && (
                <p className="text-xs text-[--muted]">
                  Fiscalità: <span className="text-[--ink]">{kidExtracted.taxation_note.value}</span>
                </p>
              )}

              {/* Il form kid-confirm-form è NESTED qui — questo è intenzionale e load-bearing */}
              <form id="kid-confirm-form" action={confirmAction} className="flex items-center gap-3 pt-1">
                <Button
                  type="submit"
                  disabled={confirmPending || !instr.symbol}
                  loading={confirmPending}
                >
                  Conferma dati KID
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setKidExtracted(null)
                    setKidReview(null)
                    setKidErr(null)
                    if (kidFileRef.current) kidFileRef.current.value = ''
                  }}
                >
                  Annulla
                </Button>
                {!instr.symbol && (
                  <p className="text-xs text-[--warning]">Compila prima il simbolo strumento</p>
                )}
              </form>

              {confirmKidState?.error   && <p className="text-sm text-[--danger]">{confirmKidState.error}</p>}
              {confirmKidState?.success && <p className="text-sm text-[--brand]">{confirmKidState.success}</p>}
            </div>
          )}
        </div>

        {/* ── Tipo + data ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo" htmlFor="txn-type">
            <Select
              id="txn-type"
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              <option value="buy">Acquisto</option>
              <option value="sell">Vendita</option>
              <option value="dividend">Dividendo</option>
              <option value="fee">Commissione</option>
            </Select>
          </Field>
          <Field label="Data" htmlFor="txn-date">
            <Input
              id="txn-date"
              type="date"
              name="trade_date"
              required
            />
          </Field>
        </div>

        {/* ISIN hidden — il valore controllato viene portato nel form principale */}
        <input type="hidden" name="isin" value={instr.isin} />

        {/* ── Strumento ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Simbolo (ticker)" htmlFor="txn-symbol">
            <Input
              id="txn-symbol"
              name="symbol"
              value={instr.symbol}
              onChange={setField('symbol')}
              required
              placeholder="es. VWCE.DE"
              className="uppercase"
            />
          </Field>
          <Field label="Nome strumento" htmlFor="txn-instr-name">
            <Input
              id="txn-instr-name"
              name="instrument_name"
              value={instr.name}
              onChange={setField('name')}
              required
              placeholder="es. Vanguard FTSE All-World"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Tipo strumento" htmlFor="txn-cluster">
            <Select
              id="txn-cluster"
              name="cluster"
              value={instr.cluster}
              onChange={setField('cluster')}
            >
              {Object.entries(CLUSTER_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="Valuta" htmlFor="txn-currency">
            <Input
              id="txn-currency"
              name="currency"
              value={instr.currency}
              onChange={setField('currency')}
              maxLength={3}
              required
              className="uppercase"
            />
          </Field>
          <Field label="Fonte prezzo" htmlFor="txn-source">
            <Select
              id="txn-source"
              name="price_source"
              value={instr.price_source}
              onChange={setField('price_source')}
            >
              {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </Field>
          <Field label="TER % / anno" htmlFor="txn-ter">
            <Input
              id="txn-ter"
              name="ter"
              value={instr.ter}
              onChange={setField('ter')}
              placeholder="es. 0.22"
            />
          </Field>
        </div>

        {/* ── Campi buy/sell ─────────────────────────────────────────────────── */}
        {isBuySell && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Quantità" htmlFor="txn-qty">
              <Input
                id="txn-qty"
                name="quantity"
                required
                placeholder="es. 10"
              />
            </Field>
            <Field htmlFor="txn-price">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="txn-price" className="text-sm font-medium text-[--ink]">
                  Prezzo unitario
                  {isFetching && (
                    <span className="ml-1 text-[--faint] animate-pulse text-xs">aggiorno…</span>
                  )}
                </label>
                {!isFetching && instr.symbol && (
                  <button
                    type="button"
                    onClick={() => fetchDetails(instr.symbol)}
                    className="text-xs text-[--faint] hover:text-[--brand] transition-colors flex items-center gap-1"
                    title="Ricarica prezzo corrente"
                  >
                    <RefreshCw className="size-3" />
                    aggiorna
                  </button>
                )}
              </div>
              <Input
                id="txn-price"
                name="unit_price"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
                placeholder="es. 95.42"
                className="font-mono"
              />
              {fetchMsg && <p className="text-xs text-[--warning] mt-1">{fetchMsg}</p>}
            </Field>
            <Field label="Commissione" htmlFor="txn-fee">
              <Input
                id="txn-fee"
                name="fee"
                placeholder="es. 4.95"
              />
            </Field>
          </div>
        )}

        {/* ── Importo dividend/fee ────────────────────────────────────────────── */}
        {isDivOrFee && (
          <Field
            label={type === 'dividend' ? 'Importo dividendo' : 'Importo commissione'}
            htmlFor="txn-amount"
            className="max-w-xs"
          >
            <Input
              id="txn-amount"
              name="amount"
              required
              placeholder="es. 12.50"
            />
          </Field>
        )}

        <Field label="Nota (opzionale)" htmlFor="txn-note">
          <Input
            id="txn-note"
            name="note"
          />
        </Field>

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" loading={pending}>
            Salva operazione
          </Button>
          <Button type="button" variant="ghost" onClick={handleClose}>
            Annulla
          </Button>
        </div>

        {state?.error && <p className="text-sm text-[--danger]">{state.error}</p>}
      </form>
    </Card>
  )
}
