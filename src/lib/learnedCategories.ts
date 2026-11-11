// src/lib/learnedCategories.ts — Categorie apprese dallo storico dell'utente.
//
// Classificatore naive Bayes locale (nessun servizio esterno), addestrato sui
// movimenti che l'utente ha già categorizzato. Interviene solo dopo la catena
// deterministica (regola utente → alias merchant → MCC → codice bancario),
// quando nessuna di queste dà una risposta, e solo con una confidenza alta.
//
// Ogni indizio è un fattore separato, così una descrizione lunga non pesa più
// del merchant, del conto o dell'importo:
//   P(parole | c) × P(merchant | c) × P(conto | c) × P(direzione | c) × N(log10|importo| ; c)
// con prior uniforme: una categoria frequente (es. Supermercato) non vince
// solo perché è frequente.
//
// Le proposte del modello stesso (category_source = 'learned') non entrano
// mai nell'addestramento: un errore non conferma sé stesso. Diventano
// esempi solo quando l'utente le corregge o le conferma (→ 'manual').
import { sqlite } from '@/db'
import { normalizeDescription } from './merchants'
import type { InsertableTransaction } from './transactions'

export interface LearnableTxn {
  description_raw:  string
  counterparty_raw?: string | null
  amount_minor:     number
  bank_account_id:  number
  merchant_id?:     number | null
}

interface TrainingTxn extends LearnableTxn {
  category_id:     number
  category_source: string
  category_kind?:  string | null   // 'expense' | 'income' | 'transfer'
}

export interface LearnedCategory {
  categoryId: number
  confidence: number
}

export interface CategoryModel {
  classify(txn: LearnableTxn): LearnedCategory | null
  /** Numero di esempi e di categorie usati, per spiegarlo in interfaccia. */
  readonly examples:   number
  readonly categories: number
}

// Sotto queste soglie il modello non risponde: troppo pochi esempi per
// distinguere un'abitudine da una coincidenza.
const MIN_TRAINING_TRANSACTIONS = 20
const MIN_CATEGORIES = 2
const MIN_EXAMPLES_PER_CATEGORY = 3
// Confidenza minima (punteggio softmax, non una probabilità calibrata).
// Naive Bayes tende a essere troppo sicuro di sé: da sola la soglia non basta,
// serve anche un indizio distintivo (vedi EVIDENCE_*). Valori scelti con una
// valutazione temporale sullo storico reale (addestramento sui mesi precedenti,
// verifica sul mese): ~94% di proposte corrette coprendo ~70% dei movimenti,
// contro ~82% senza il requisito di indizio distintivo.
const DEFAULT_THRESHOLD = 0.8
// Indizio distintivo: una parola o un merchant che nello storico compare almeno
// EVIDENCE_MIN_COUNT volte, per almeno EVIDENCE_SHARE delle volte nella categoria.
const EVIDENCE_SHARE = 0.9
const EVIDENCE_MIN_COUNT = 2
// Una scelta manuale è un indizio più affidabile di un'assegnazione automatica.
const MANUAL_WEIGHT = 2
const ALPHA = 1
const AMOUNT_MAX_Z = 3
const AMOUNT_VARIANCE_SHRINK = 2
const AMOUNT_MIN_VARIANCE = 0.001

/** Parole significative: niente numeri puri, codici di riferimento o lettere singole. */
export function tokenize(description: string, counterparty?: string | null): string[] {
  const text = normalizeDescription(`${description} ${counterparty ?? ''}`)
  const words = text.match(/[\p{L}\p{N}]+/gu) ?? []
  return [...new Set(words.filter((w) =>
    w.length >= 2
    && /\p{L}/u.test(w)                     // almeno una lettera
    && !/^(?=.*\p{L})(?=(?:.*\p{N}){2})/u.test(w)))] // non un codice tipo "2k4l19"
}

const direction = (amountMinor: number) => (amountMinor < 0 ? 'out' : 'in')
const logAmount = (amountMinor: number) => Math.log10(Math.max(Math.abs(amountMinor), 1))

interface ClassStats {
  weight:     number
  words:      Map<string, number>
  wordTotal:  number
  merchants:  Map<number, number>
  accounts:   Map<number, number>
  directions: Map<string, number>
  amounts:    { sum: number; sumSq: number; n: number }
}

function newStats(): ClassStats {
  return {
    weight: 0, words: new Map(), wordTotal: 0, merchants: new Map(), accounts: new Map(),
    directions: new Map(), amounts: { sum: 0, sumSq: 0, n: 0 },
  }
}

const bump = <K>(map: Map<K, number>, key: K, by: number) => map.set(key, (map.get(key) ?? 0) + by)

/** Addestra il modello su righe già categorizzate. Funzione pura (testabile). */
export function trainFromRows(rows: TrainingTxn[]): CategoryModel | null {
  const training = rows.filter((r) => r.category_source !== 'learned')
  const counts = new Map<number, number>()
  for (const r of training) bump(counts, r.category_id, 1)
  const eligible = new Set([...counts].filter(([, n]) => n >= MIN_EXAMPLES_PER_CATEGORY).map(([id]) => id))
  const usable = training.filter((r) => eligible.has(r.category_id))
  if (usable.length < MIN_TRAINING_TRANSACTIONS || eligible.size < MIN_CATEGORIES) return null

  const classes = new Map<number, ClassStats>()
  const incomeClasses = new Set(usable.filter((r) => r.category_kind === 'income').map((r) => r.category_id))
  const vocabulary = new Set<string>()
  const merchants = new Set<number>()
  const accounts = new Set<number>()
  let globalSum = 0, globalSumSq = 0

  for (const r of usable) {
    const w = r.category_source === 'manual' ? MANUAL_WEIGHT : 1
    const s = classes.get(r.category_id) ?? newStats()
    classes.set(r.category_id, s)
    s.weight += w
    for (const token of tokenize(r.description_raw, r.counterparty_raw)) {
      vocabulary.add(token); bump(s.words, token, w); s.wordTotal += w
    }
    if (r.merchant_id != null) { merchants.add(r.merchant_id); bump(s.merchants, r.merchant_id, w) }
    accounts.add(r.bank_account_id); bump(s.accounts, r.bank_account_id, w)
    bump(s.directions, direction(r.amount_minor), w)
    const a = logAmount(r.amount_minor)
    s.amounts.sum += a; s.amounts.sumSq += a * a; s.amounts.n++
    globalSum += a; globalSumSq += a * a
  }

  const wordCounts = new Map<string, number>()
  const merchantCounts = new Map<number, number>()
  for (const st of classes.values()) {
    for (const [t, c] of st.words) bump(wordCounts, t, c)
    for (const [m, c] of st.merchants) bump(merchantCounts, m, c)
  }

  const n = usable.length
  const globalMean = globalSum / n
  const globalVar = Math.max(globalSumSq / n - globalMean * globalMean, AMOUNT_MIN_VARIANCE)
  const amountModel = new Map([...classes].map(([id, s]) => {
    const mean = s.amounts.sum / s.amounts.n
    const raw = Math.max(s.amounts.sumSq / s.amounts.n - mean * mean, 0)
    // Varianza della categoria avvicinata a quella globale: con pochi esempi
    // tutti uguali la curva non diventa un ago.
    const variance = Math.max(
      (raw * s.amounts.n + globalVar * AMOUNT_VARIANCE_SHRINK) / (s.amounts.n + AMOUNT_VARIANCE_SHRINK),
      AMOUNT_MIN_VARIANCE)
    return [id, { mean, variance }] as const
  }))

  function classify(txn: LearnableTxn): LearnedCategory | null {
    const tokens = tokenize(txn.description_raw, txn.counterparty_raw).filter((t) => vocabulary.has(t))
    const knownMerchant = txn.merchant_id != null && merchants.has(txn.merchant_id)
    // Senza parole note né merchant noto, conto e importo da soli non bastano.
    if (tokens.length === 0 && !knownMerchant) return null

    const scores: [number, number][] = []
    for (const [id, s] of classes) {
      // Un'uscita non è mai un'entrata, qualunque cosa dicano le parole.
      if (txn.amount_minor < 0 && incomeClasses.has(id)) continue
      let score = 0
      for (const t of tokens) {
        score += Math.log(((s.words.get(t) ?? 0) + ALPHA) / (s.wordTotal + ALPHA * vocabulary.size))
      }
      if (knownMerchant) {
        score += Math.log(((s.merchants.get(txn.merchant_id!) ?? 0) + ALPHA) / (s.weight + ALPHA * (merchants.size + 1)))
      }
      score += Math.log(((s.accounts.get(txn.bank_account_id) ?? 0) + ALPHA) / (s.weight + ALPHA * (accounts.size + 1)))
      score += Math.log(((s.directions.get(direction(txn.amount_minor)) ?? 0) + ALPHA) / (s.weight + ALPHA * 2))
      const { mean, variance } = amountModel.get(id)!
      const z = Math.min(Math.abs(logAmount(txn.amount_minor) - mean) / Math.sqrt(variance), AMOUNT_MAX_Z)
      score += -0.5 * z * z - 0.5 * Math.log(variance)
      scores.push([id, score])
    }
    if (scores.length === 0) return null
    const max = Math.max(...scores.map(([, s]) => s))
    const total = scores.reduce((acc, [, s]) => acc + Math.exp(s - max), 0)
    const [bestId, bestScore] = scores.reduce((a, b) => (b[1] > a[1] ? b : a))
    {
      // Serve almeno un indizio distintivo della categoria vincente: una parola
      // (o il merchant) che nello storico compare soprattutto lì. Parole comuni
      // a molte categorie, come la città, non bastano.
      const best = classes.get(bestId)!
      const distinctive = (inBest: number, overall: number) =>
        inBest >= EVIDENCE_MIN_COUNT && inBest / overall >= EVIDENCE_SHARE
      const seen = tokens.some((t) => distinctive(best.words.get(t) ?? 0, wordCounts.get(t)!))
        || (knownMerchant && distinctive(best.merchants.get(txn.merchant_id!) ?? 0, merchantCounts.get(txn.merchant_id!)!))
      if (!seen) return null
    }
    return { categoryId: bestId, confidence: Math.exp(bestScore - max) / total }
  }

  return { classify, examples: n, categories: classes.size }
}

/**
 * Modello dell'utente, addestrato sui suoi movimenti categorizzati.
 * `before` (YYYY-MM-DD) limita l'addestramento ai movimenti precedenti
 * (valutazione su dati futuri).
 */
export function trainCategoryModel(ownerId: number, opts: { before?: string } = {}): CategoryModel | null {
  const rows = sqlite.prepare(
    `SELECT t.description_raw, t.counterparty_raw, t.amount_minor, t.bank_account_id, t.merchant_id,
            t.category_id, t.category_source, c.kind AS category_kind
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.owner_id = ? AND t.category_source != 'learned'
       ${opts.before ? 'AND t.booked_date < ?' : ''}`,
  ).all(...(opts.before ? [ownerId, opts.before] : [ownerId])) as TrainingTxn[]
  return trainFromRows(rows)
}

/** Categoria appresa solo se supera la soglia; altrimenti null. */
export function learnedCategory(
  model: CategoryModel | null,
  txn: LearnableTxn,
  threshold = DEFAULT_THRESHOLD,
): LearnedCategory | null {
  const result = model?.classify(txn) ?? null
  return result && result.confidence >= threshold ? result : null
}

/**
 * Completa con la categoria appresa le righe in arrivo (sync o import) rimaste
 * senza categoria dopo la catena deterministica. Le righe già categorizzate non
 * vengono toccate. Il modello si addestra una volta per lotto e solo se serve.
 */
export function fillLearnedCategories(ownerId: number, rows: InsertableTransaction[]): InsertableTransaction[] {
  if (!rows.some((r) => r.category_id == null)) return rows
  const model = trainCategoryModel(ownerId)
  if (!model) return rows
  return rows.map((r) => {
    if (r.category_id != null) return r
    const learned = learnedCategory(model, r)
    return learned ? { ...r, category_id: learned.categoryId, category_source: 'learned' as const } : r
  })
}
