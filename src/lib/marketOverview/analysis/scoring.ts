// src/lib/marketOverview/analysis/scoring.ts — Motore di sintesi TRASPARENTE.
//
// Ogni driver produce un punteggio in [-1,+1] dove **+1 = condizioni
// storicamente favorevoli a un ingresso, −1 = sfavorevoli**. Le convenzioni di
// segno sono fisse, documentate e revisionabili qui: nessun modello opaco.
// I punteggi si aggregano in una media pesata rinormalizzata sui driver
// effettivamente disponibili (se un dato manca, il suo peso si ridistribuisce).
//
// IMPORTANTE: questi punteggi descrivono il CONTESTO rispetto allo storico, non
// una previsione. "Favorevole all'ingresso" = "storicamente a questi livelli le
// condizioni erano più distese", mai "salirà".
import type { Driver, Reading, Stance, Confidence, SectorAnalysis, LearnMore } from './types'

export function clamp(x: number, lo = -1, hi = 1): number {
  return Math.max(lo, Math.min(hi, x))
}

/** Lettura qualitativa a partire dal punteggio. */
export function readingFromScore(score: number): Reading {
  if (!Number.isFinite(score)) return 'neutral'
  if (score >= 0.2) return 'favorable'
  if (score <= -0.2) return 'unfavorable'
  return 'neutral'
}

// ── Aggregazione ────────────────────────────────────────────────────────────

/** Media pesata rinormalizzata sui soli driver con dato valido (peso>0, score finito). */
export function aggregate(drivers: Driver[]): number {
  const present = drivers.filter((d) => Number.isFinite(d.score) && d.weight > 0)
  const wsum = present.reduce((s, d) => s + d.weight, 0)
  if (wsum === 0) return 0
  return clamp(present.reduce((s, d) => s + d.score * d.weight, 0) / wsum)
}

// Soglie fisse stance. Volutamente conservative: "accumulate"/"caution" solo
// quando il quadro è nettamente sbilanciato.
export function stanceFromScore(score: number): Stance {
  if (score >= 0.4)  return 'accumulate'
  if (score >= 0.15) return 'lean-accumulate'
  if (score > -0.15) return 'neutral'
  if (score > -0.4)  return 'lean-caution'
  return 'caution'
}

export function confidenceFromCoverage(present: number, total: number): Confidence {
  if (total === 0) return 'bassa'
  const r = present / total
  if (r >= 0.8) return 'alta'
  if (r >= 0.5) return 'media'
  return 'bassa'
}

export const STANCE_HEADLINE: Record<Stance, string> = {
  accumulate:        'Contesto storicamente favorevole all’accumulo',
  'lean-accumulate': 'Contesto moderatamente favorevole',
  neutral:           'Contesto neutro',
  'lean-caution':    'Contesto che invita a una certa cautela',
  caution:           'Contesto teso — cautela',
}

/** Costruisce il paragrafo argomentato: tensione tra fattori pro e contro. */
export function buildNarrative(
  title:    string,
  stance:   Stance,
  drivers:  Driver[],
  historicalNote?: string,
): string {
  const valid = drivers.filter((d) => Number.isFinite(d.score) && d.weight > 0)
  // Non abbassiamo il case: molti label sono nomi propri (BTP, USA, VIX).
  const pros = valid.filter((d) => d.reading === 'favorable').map((d) => d.label)
  const cons = valid.filter((d) => d.reading === 'unfavorable').map((d) => d.label)

  const parts: string[] = [`${title}: ${STANCE_HEADLINE[stance].toLowerCase()}.`]
  if (pros.length) parts.push(`A favore di un ingresso: ${listIt(pros)}.`)
  if (cons.length) parts.push(`Motivi di cautela: ${listIt(cons)}.`)
  if (!pros.length && !cons.length) parts.push('Gli indicatori disponibili non mostrano squilibri marcati rispetto allo storico.')
  if (historicalNote) parts.push(historicalNote)
  parts.push('Valutazione generale di contesto, non un’indicazione personalizzata.')
  return parts.join(' ')
}

function listIt(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

/** Assembla la SectorAnalysis calcolando score/stance/confidence/narrativa. */
export function synthesize(params: {
  key:        string
  title:      string
  drivers:    Driver[]
  asOf:       number
  learnMore?: LearnMore[]
  historicalNote?: string
  subMarkets?: SectorAnalysis[]
}): SectorAnalysis {
  const score = aggregate(params.drivers)
  const stance = stanceFromScore(score)
  const present = params.drivers.filter((d) => Number.isFinite(d.score) && d.weight > 0).length
  const confidence = confidenceFromCoverage(present, params.drivers.length)
  return {
    key:        params.key,
    title:      params.title,
    stance,
    score:      Math.round(score * 100) / 100,
    confidence,
    headline:   STANCE_HEADLINE[stance],
    narrative:  buildNarrative(params.title, stance, params.drivers, params.historicalNote),
    drivers:    params.drivers,
    learnMore:  params.learnMore ?? [],
    asOf:       params.asOf,
    ...(params.subMarkets ? { subMarkets: params.subMarkets } : {}),
  }
}

// ── Builder dei driver (encapsulano le convenzioni di segno) ──────────────────
// Ognuno accetta un valore eventualmente null/NaN: in tal caso ritorna un driver
// "dato non disponibile" (peso 0) così l'assenza è visibile e la confidenza cala.
// Ogni builder porta con sé la spiegazione in linguaggio semplice di ciò che
// misura (`explain`): la pagina è pensata per chi non mastica finanza.

interface DriverMeta { label: string; source: string; weight: number; signalCode?: string }

function base(meta: DriverMeta, explain: string) {
  return { label: meta.label, source: meta.source, explain, ...(meta.signalCode ? { signalCode: meta.signalCode } : {}) }
}

function missing(meta: DriverMeta, explain: string): Driver {
  return { ...base(meta, explain), detail: 'dato non disponibile', reading: 'neutral', score: NaN, weight: 0 }
}

function make(meta: DriverMeta, explain: string, score: number, detail: string): Driver {
  return { ...base(meta, explain), detail, reading: readingFromScore(score), score: clamp(score), weight: meta.weight }
}

const ok = (v: number | null): v is number => v !== null && Number.isFinite(v)
/** Numero in formato italiano (virgola decimale) con decimali fissi. */
export const fmtIt = (v: number, d = 1) => v.toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d })
const signed = (v: number, d = 1) => `${v >= 0 ? '+' : '−'}${fmtIt(Math.abs(v), d)}`

const EXPLAIN = {
  pricePercentile: 'Confronta il prezzo di oggi con tutti quelli degli ultimi 10 anni: “90° percentile” vuol dire che nel 90% dei giorni è costato meno di adesso.',
  yieldPercentile: 'Confronta il rendimento offerto oggi con quelli degli ultimi 10 anni: più è alto, più interessi incassa chi compra adesso.',
  realYield:       'Il rendimento tolta l’inflazione. Se è positivo l’investimento fa crescere il potere d’acquisto, se è negativo lo erode.',
  curveSlope:      'Di norma prestare soldi per 10 anni rende più che per 2. Quando succede il contrario (“curva invertita”) i mercati si aspettano un rallentamento dell’economia.',
  spread:          'Il rendimento in più che il mercato chiede all’Italia rispetto alla Germania: più è ampio, più il debito italiano è percepito come rischioso.',
  drawdown:        'Di quanto il prezzo è sceso rispetto al massimo dell’ultimo anno. Dopo un calo si compra a prezzi più bassi che sui massimi.',
  trendVsMA:       'La distanza dal prezzo medio degli ultimi 200 giorni: molto sopra indica un rialzo già in gran parte avvenuto, sotto indica una fase di debolezza.',
  pe:              'Quante volte gli utili di un anno si paga un’azione. Più è alto, più il mercato è caro rispetto a ciò che le aziende guadagnano (storicamente tra 15 e 20).',
  cape:            'Il rapporto prezzo/utili calcolato sulla media degli utili di 10 anni, per non farsi ingannare da un singolo anno buono o cattivo. È la misura di valutazione con più storia alle spalle.',
  excessYield:     'Quanto rendono gli utili delle azioni in più rispetto a un titolo di Stato al netto dell’inflazione. Più è basso, meno si viene ricompensati per il rischio azionario.',
  vix:             'Misura quanta agitazione gli investitori si aspettano. Paradossalmente, i momenti di paura sono stati in media punti d’ingresso migliori di quelli di calma.',
  momentum:        'Di quanto è salito o sceso il prezzo nel periodo. Dopo forti rialzi è più facile comprare caro; pesa poco nella valutazione.',
  fearGreed:       'Un termometro da 0 (paura estrema) a 100 (avidità estrema) dell’umore di chi investe in crypto. L’euforia tende a precedere i cali.',
  btc200w:         'La distanza del Bitcoin dal suo prezzo medio di quasi 4 anni. Storicamente è stato molto sopra a fine dei grandi rialzi e vicino o sotto nei momenti di sconforto.',
  goldVsRealYield: 'L’oro non paga interessi: quando le obbligazioni rendono bene al netto dell’inflazione tenerlo “costa” di più, quando rendono poco diventa più attraente.',
  goldSilver:      'Quante once d’argento servono per un’oncia d’oro. Un valore molto alto indica oro caro rispetto all’argento, spesso in fasi di tensione.',
}

/** Percentile di "carezza" (prezzo/valutazione): alto = caro = sfavorevole. */
export function driverPricePercentile(meta: DriverMeta, percentile: number | null, window: string): Driver {
  if (!ok(percentile)) return missing(meta, EXPLAIN.pricePercentile)
  return make(meta, EXPLAIN.pricePercentile, -(percentile - 50) / 50, `${Math.round(percentile)}° percentile (${window})`)
}

/** Percentile del rendimento (bond): alto = più reddito = favorevole. */
export function driverYieldPercentile(meta: DriverMeta, percentile: number | null, window: string): Driver {
  if (!ok(percentile)) return missing(meta, EXPLAIN.yieldPercentile)
  return make(meta, EXPLAIN.yieldPercentile, (percentile - 50) / 50, `${Math.round(percentile)}° percentile (${window})`)
}

/** Rendimento reale (nominale − inflazione): positivo/alto = favorevole. */
export function driverRealYield(meta: DriverMeta, realPct: number | null, basis = '10Y − inflazione'): Driver {
  if (!ok(realPct)) return missing(meta, EXPLAIN.realYield)
  return make(meta, EXPLAIN.realYield, clamp(realPct / 3), `${fmtIt(realPct, 1)}% reale (${basis})`)
}

/** Pendenza curva 10Y−2Y: inversione (negativa) = cautela; positiva = sana. */
export function driverCurveSlope(meta: DriverMeta, slopePct: number | null): Driver {
  if (!ok(slopePct)) return missing(meta, EXPLAIN.curveSlope)
  const score = slopePct >= 0 ? Math.min(slopePct / 2, 0.3) : Math.max(slopePct, -1)
  return make(meta, EXPLAIN.curveSlope, score, `curva ${signed(slopePct, 2)}pp (10Y−2Y)`)
}

/** Spread sovrano (es. BTP-Bund) in punti base: ampio = più rischio. */
export function driverSpread(meta: DriverMeta, spreadBps: number | null): Driver {
  if (!ok(spreadBps)) return missing(meta, EXPLAIN.spread)
  return make(meta, EXPLAIN.spread, clamp((150 - spreadBps) / 150, -1, 0.4), `${Math.round(spreadBps)} pb di spread`)
}

/** Distanza % dai massimi 52w: ai massimi = ingresso meno favorevole; drawdown = più favorevole. */
export function driverDrawdown(meta: DriverMeta, drawdownPct: number | null): Driver {
  if (!ok(drawdownPct)) return missing(meta, EXPLAIN.drawdown)
  return make(meta, EXPLAIN.drawdown, clamp((drawdownPct - 5) / 25), `${fmtIt(drawdownPct, 1)}% sotto i max 52w`)
}

/** Distanza % dalla media 200gg: molto sopra = esteso; sotto = potenziale sconto. */
export function driverTrendVsMA(meta: DriverMeta, pctFromMA: number | null): Driver {
  if (!ok(pctFromMA)) return missing(meta, EXPLAIN.trendVsMA)
  return make(meta, EXPLAIN.trendVsMA, clamp(-pctFromMA / 20), `${signed(pctFromMA)}% vs media 200gg`)
}

/** P/E trailing con bande fisse: cheap≈15, rich≈25. */
export function driverPE(meta: DriverMeta, pe: number | null): Driver {
  if (!ok(pe) || pe <= 0) return missing(meta, EXPLAIN.pe)
  return make(meta, EXPLAIN.pe, clamp((20 - pe) / 10), `P/E ${fmtIt(pe, 1)}`)
}

/** CAPE di Shiller, giudicato sul suo percentile storico: alto = caro = sfavorevole. */
export function driverCape(meta: DriverMeta, cape: number | null, percentile: number | null, window: string): Driver {
  if (!ok(cape) || !ok(percentile)) return missing(meta, EXPLAIN.cape)
  return make(meta, EXPLAIN.cape, -(percentile - 50) / 50, `CAPE ${fmtIt(cape, 1)} · ${Math.round(percentile)}° percentile (${window})`)
}

/** Excess CAPE Yield (premio delle azioni sui bond reali): alto = favorevole. */
export function driverExcessYield(meta: DriverMeta, ecyPct: number | null, percentile: number | null, window: string): Driver {
  if (!ok(ecyPct) || !ok(percentile)) return missing(meta, EXPLAIN.excessYield)
  return make(meta, EXPLAIN.excessYield, (percentile - 50) / 50, `${fmtIt(ecyPct, 1)}% · ${Math.round(percentile)}° percentile (${window})`)
}

/** VIX: alto (paura) = storicamente ingressi migliori; basso (compiacenza) = meno. */
export function driverVix(meta: DriverMeta, vix: number | null): Driver {
  if (!ok(vix)) return missing(meta, EXPLAIN.vix)
  return make(meta, EXPLAIN.vix, clamp((vix - 20) / 20), `VIX ${fmtIt(vix, 1)}`)
}

/** Momentum (%): estremi positivi = rincorsa/ipercomprato; negativi = sconto. Peso basso. */
export function driverMomentum(meta: DriverMeta, momentumPct: number | null, horizon: string): Driver {
  if (!ok(momentumPct)) return missing(meta, EXPLAIN.momentum)
  return make(meta, EXPLAIN.momentum, clamp(-momentumPct / 50, -0.6, 0.6), `${signed(momentumPct)}% ${horizon}`)
}

/** Fear & Greed (0-100): avidità estrema = cautela; paura estrema = favorevole. */
export function driverFearGreed(meta: DriverMeta, value: number | null): Driver {
  if (!ok(value)) return missing(meta, EXPLAIN.fearGreed)
  return make(meta, EXPLAIN.fearGreed, clamp((50 - value) / 50), `indice ${Math.round(value)}/100`)
}

/** BTC vs media 200 settimane (% sopra): molto sopra = fine ciclo; vicino/sotto = accumulo. */
export function driverBtc200w(meta: DriverMeta, pctAbove: number | null): Driver {
  if (!ok(pctAbove)) return missing(meta, EXPLAIN.btc200w)
  return make(meta, EXPLAIN.btc200w, clamp(-pctAbove / 150), `${signed(pctAbove, 0)}% vs media 200sett`)
}

/** Oro vs rendimenti reali: l'oro non rende cedole, quindi rendimenti reali
 *  BASSI/negativi lo favoriscono (minor costo-opportunità), alti lo penalizzano. */
export function driverGoldVsRealYield(meta: DriverMeta, realPct: number | null): Driver {
  if (!ok(realPct)) return missing(meta, EXPLAIN.goldVsRealYield)
  return make(meta, EXPLAIN.goldVsRealYield, clamp(-realPct / 3), `rendimenti reali ${signed(realPct)}%`)
}

/** Rapporto oro/argento: molto alto (>80) storicamente = stress/oro caro vs argento. Peso basso. */
export function driverGoldSilver(meta: DriverMeta, ratio: number | null): Driver {
  if (!ok(ratio)) return missing(meta, EXPLAIN.goldSilver)
  return make(meta, EXPLAIN.goldSilver, clamp((70 - ratio) / 40), `rapporto oro/argento ${fmtIt(ratio, 0)}`)
}

/** Un sotto-mercato che diventa driver del settore padre (azionario). */
export function driverFromSubMarket(sub: SectorAnalysis, weight: number): Driver {
  return {
    label:   sub.title,
    detail:  sub.headline,
    reading: readingFromScore(sub.score),
    score:   sub.score,
    weight,
    source:  'sintesi',
  }
}
