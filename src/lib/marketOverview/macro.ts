// src/lib/marketOverview/macro.ts — "Cosa sta succedendo nel mondo": il quadro
// macroeconomico in cinque temi (inflazione, tassi, crescita e lavoro, stress
// dei mercati, cambio), ognuno con pochi indicatori ufficiali e una lettura in
// linguaggio semplice.
//
// Stesso principio del resto della pagina: SOLO dati di fonti istituzionali
// (Eurostat, BCE, Federal Reserve via FRED) e classificazione a SOGLIE FISSE
// documentate qui sotto. Nessuna previsione: si descrive dove siamo e in che
// direzione ci si sta muovendo, non dove si andrà.
import { fetchEcb, type Observation } from './bonds'
import { fetchFred } from './fred'
import { fetchHicpAnnualRate } from './eurostat'
import { downsample, type SeriesPoint } from './signals'

export type MacroTone = 'calm' | 'watch' | 'alert'
export type MacroThemeKey = 'inflation' | 'rates' | 'growth' | 'stress' | 'currency'

export interface MacroIndicator {
  code:     string
  title:    string
  value:    number
  unit:     string        // '%', 'pt', '' …
  decimals: number
  period:   string        // periodo del dato, es. '2026-09' | '2026-Q1' | '2026-10-05'
  note?:    string        // contesto in una riga, es. "un anno fa: 2,1%"
  source:   string
  /** Serie per il grafico. Presente quando il tema è appena stato costruito;
   *  NON viene salvata in cache (i grafici la richiedono al momento, vedi series.ts). */
  series?:  SeriesPoint[]
}

export interface MacroTheme {
  key:          MacroThemeKey
  title:        string
  status:       string     // etichetta breve, es. "Sopra l'obiettivo, in aumento"
  tone:         MacroTone
  summary:      string     // cosa sta succedendo, in parole semplici
  whyItMatters: string     // perché interessa a chi investe
  indicators:   MacroIndicator[]
}

export interface MacroOverview {
  themes: MacroTheme[]
  asOf:   number
}

const SRC_EUROSTAT = 'Eurostat'
const SRC_ECB      = 'BCE (ECB Data Portal)'
const SRC_FRED     = 'FRED (Federal Reserve di St. Louis)'

// ── Helper puri (testati) ─────────────────────────────────────────────────────

const last = (s: Observation[]): Observation | null => (s.length ? s[s.length - 1] : null)

/** Osservazione di `n` periodi prima dell'ultima (null se la serie è troppo corta). */
export function lagged(s: Observation[], n: number): Observation | null {
  return s.length > n ? s[s.length - 1 - n] : null
}

/** Variazione % anno su anno di una serie di LIVELLI con `perYear` osservazioni l'anno. */
export function yoyFromLevels(s: Observation[], perYear: number): Observation[] {
  const out: Observation[] = []
  for (let i = perYear; i < s.length; i++) {
    const base = s[i - perYear].value
    if (base > 0) out.push({ period: s[i].period, value: (s[i].value / base - 1) * 100 })
  }
  return out
}

export type Direction = 'up' | 'down' | 'flat'

/** Direzione rispetto a `n` periodi fa, con soglia di indifferenza `eps`. */
export function direction(s: Observation[], n: number, eps: number): Direction {
  const now = last(s)
  const then = lagged(s, n)
  if (!now || !then) return 'flat'
  const d = now.value - then.value
  return d > eps ? 'up' : d < -eps ? 'down' : 'flat'
}

export interface RateChange { date: string; from: number; to: number }

/** Ultima variazione di un tasso "a gradini" (tassi ufficiali). Null se mai cambiato nella finestra. */
export function lastRateChange(s: Observation[]): RateChange | null {
  for (let i = s.length - 1; i > 0; i--) {
    if (s[i].value !== s[i - 1].value) return { date: s[i].period, from: s[i - 1].value, to: s[i].value }
  }
  return null
}

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

/** '2026-09' → 'set 2026'; '2026-Q1' → 'T1 2026'; '2026-10-05' → '5 ott 2026'. */
export function periodLabel(period: string): string {
  const q = period.match(/^(\d{4})-Q(\d)$/)
  if (q) return `T${q[2]} ${q[1]}`
  const [y, m, d] = period.split('-')
  const mm = MONTHS[parseInt(m, 10) - 1]
  if (!mm) return period
  return d ? `${parseInt(d, 10)} ${mm} ${y}` : `${mm} ${y}`
}

const it = (n: number, decimals = 1) => n.toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

/** Preposizione articolata corretta davanti a una percentuale: "del 3,8%", "dello 0,5%", "dell’8,1%". */
export function delPct(n: number, decimals = 1): string {
  const s = it(Math.abs(n), decimals)
  const prep = s.startsWith('0') ? 'dello ' : /^(8|11)(\D|$)/.test(s) ? 'dell’' : 'del '
  return `${prep}${s}%`
}

function monthsBetween(isoDate: string, now: Date): number {
  const d = new Date(`${isoDate}T00:00:00Z`)
  return (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + (now.getUTCMonth() - d.getUTCMonth())
}

function indicator(p: {
  code: string; title: string; series: Observation[]; unit: string; decimals: number; source: string; note?: string
}): MacroIndicator | null {
  const l = last(p.series)
  if (!l) return null
  return {
    code: p.code, title: p.title, value: l.value, unit: p.unit, decimals: p.decimals, period: l.period,
    source: p.source,
    series: downsample(p.series.map((o) => ({ t: o.period, v: Math.round(o.value * 1000) / 1000 }))),
    ...(p.note ? { note: p.note } : {}),
  }
}

const present = <T,>(xs: (T | null)[]): T[] => xs.filter((x): x is T => x !== null)

// FRED data ogni osservazione al primo giorno del periodo: "2026-08-01" per
// agosto, "2026-04-01" per il 2° trimestre. Si riportano al periodo vero.
export const toMonthly = (s: Observation[]): Observation[] => s.map((o) => ({ ...o, period: o.period.slice(0, 7) }))
export const toQuarterly = (s: Observation[]): Observation[] =>
  s.map((o) => ({ ...o, period: `${o.period.slice(0, 4)}-Q${Math.floor((parseInt(o.period.slice(5, 7), 10) - 1) / 3) + 1}` }))

// ── Classificatori a soglie fisse (testati) ───────────────────────────────────

/** Inflazione rispetto all'obiettivo BCE del 2%. */
export function classifyInflation(rate: number, dir: Direction): { status: string; tone: MacroTone } {
  const trend = dir === 'up' ? ', in aumento' : dir === 'down' ? ', in calo' : ', stabile'
  if (rate > 4)    return { status: `Elevata${trend}`, tone: 'alert' }
  if (rate > 2.5)  return { status: `Sopra l’obiettivo del 2%${trend}`, tone: 'watch' }
  if (rate >= 1)   return { status: `Vicina all’obiettivo del 2%${trend}`, tone: 'calm' }
  return { status: `Molto bassa${trend}`, tone: 'watch' }
}

/** Fase della politica monetaria dall'ultima mossa: conta solo se recente (≤12 mesi). */
export function classifyPolicy(change: RateChange | null, now: Date): { phase: 'hiking' | 'cutting' | 'hold'; text: string } {
  if (!change || monthsBetween(change.date, now) > 12) return { phase: 'hold', text: 'ferma da oltre un anno' }
  return change.to > change.from
    ? { phase: 'hiking', text: 'in fase di rialzo' }
    : { phase: 'cutting', text: 'in fase di taglio' }
}

/** Crescita reale annua del PIL. La regola di Sahm (≥0,5) segnala storicamente l'avvio di una recessione USA. */
export function classifyGrowth(gdpYoy: number | null, sahm: number | null): { status: string; tone: MacroTone } {
  if (sahm !== null && sahm >= 0.5) return { status: 'Segnale di recessione negli USA', tone: 'alert' }
  if (gdpYoy === null) return { status: 'Dato sulla crescita non disponibile', tone: 'watch' }
  if (gdpYoy < 0)   return { status: 'Economia in contrazione', tone: 'alert' }
  if (gdpYoy < 1)   return { status: 'Crescita debole', tone: 'watch' }
  if (gdpYoy < 2.5) return { status: 'Crescita moderata', tone: 'calm' }
  return { status: 'Crescita sostenuta', tone: 'calm' }
}

/** Stress finanziario: indice St. Louis Fed (0 = media storica) e VIX (≥30 = paura diffusa). */
export function classifyStress(stlfsi: number | null, vix: number | null): { status: string; tone: MacroTone } {
  if ((stlfsi !== null && stlfsi > 1) || (vix !== null && vix >= 30)) return { status: 'Tensione elevata', tone: 'alert' }
  if ((stlfsi !== null && stlfsi > 0) || (vix !== null && vix >= 20)) return { status: 'Tensione sopra la media', tone: 'watch' }
  if (stlfsi === null && vix === null) return { status: 'Dato non disponibile', tone: 'watch' }
  return { status: 'Mercati tranquilli', tone: 'calm' }
}

// ── Temi ──────────────────────────────────────────────────────────────────────

function sinceYears(n: number): string {
  const d = new Date(); d.setFullYear(d.getFullYear() - n)
  return d.toISOString().slice(0, 10)
}

async function inflationTheme(): Promise<MacroTheme | null> {
  const [ea, itl, core, usCpi] = await Promise.all([
    fetchHicpAnnualRate('EA'),
    fetchHicpAnnualRate('IT'),
    fetchHicpAnnualRate('EA', 'TOT_X_NRG_FOOD'),
    fetchFred('CPIAUCSL', sinceYears(11)),
  ])
  const eaLast = last(ea)
  if (!eaLast) return null
  const us = yoyFromLevels(toMonthly(usCpi), 12)
  const yearAgo = (s: Observation[]) => { const o = lagged(s, 12); return o ? `un anno fa: ${it(o.value)}%` : undefined }

  const { status, tone } = classifyInflation(eaLast.value, direction(ea, 6, 0.3))
  const loss = Math.round(eaLast.value * 100)
  return {
    key: 'inflation',
    title: 'Inflazione',
    status,
    tone,
    summary: `Nell’area euro i prezzi crescono ${delPct(eaLast.value)} l’anno (${periodLabel(eaLast.period)}); l’obiettivo della BCE è il 2%.`,
    whyItMatters: eaLast.value > 0
      ? `L’inflazione erode il valore dei soldi fermi: a questo ritmo 10.000 € sul conto perdono circa ${loss.toLocaleString('it-IT')} € di potere d’acquisto in un anno. Se resta sopra l’obiettivo, le banche centrali tendono a tenere i tassi più alti.`
      : 'Con prezzi fermi o in calo la liquidità non perde potere d’acquisto, ma le banche centrali tendono a tagliare i tassi per sostenere l’economia.',
    indicators: present([
      indicator({ code: 'macro.inflation.ea', title: 'Area euro', series: ea, unit: '%', decimals: 1, source: SRC_EUROSTAT, note: yearAgo(ea) }),
      indicator({ code: 'macro.inflation.it', title: 'Italia', series: itl, unit: '%', decimals: 1, source: SRC_EUROSTAT, note: yearAgo(itl) }),
      indicator({ code: 'macro.inflation.ea_core', title: 'Area euro, senza energia e alimentari', series: core, unit: '%', decimals: 1, source: SRC_EUROSTAT, note: 'la componente più stabile' }),
      indicator({ code: 'macro.inflation.us', title: 'Stati Uniti', series: us, unit: '%', decimals: 1, source: SRC_FRED, note: yearAgo(us) }),
    ]),
  }
}

async function ratesTheme(now: Date): Promise<MacroTheme | null> {
  const [dfr, fed, us10] = await Promise.all([
    fetchEcb('FM', 'D.U2.EUR.4F.KR.DFR.LEV', 3700),
    fetchFred('DFEDTARU', sinceYears(10)),
    fetchFred('DGS10', sinceYears(10)),
  ])
  const ecbLast = last(dfr)
  if (!ecbLast) return null
  const ecbChange = lastRateChange(dfr)
  const fedChange = lastRateChange(fed)
  const ecb = classifyPolicy(ecbChange, now)
  const fedLast = last(fed)
  const fedPhase = classifyPolicy(fedChange, now)

  const moveNote = (c: RateChange | null) =>
    c ? `ultima mossa: ${c.to > c.from ? 'rialzo' : 'taglio'} il ${periodLabel(c.date)} (da ${it(c.from, 2)}%)` : 'invariato negli ultimi 10 anni'

  const why: Record<typeof ecb.phase, string> = {
    hiking:  'Quando i tassi salgono, conti deposito e nuove obbligazioni rendono di più; in compenso i mutui variabili costano di più, le obbligazioni già in circolazione perdono valore e le azioni tendono a essere valutate con più severità.',
    cutting: 'Quando i tassi scendono, mutui e prestiti costano meno e le obbligazioni già in circolazione si apprezzano; in compenso conti deposito e nuove emissioni rendono meno.',
    hold:    'Con tassi stabili il rendimento di conti deposito e obbligazioni è più prevedibile: il livello attuale è il termine di paragone per qualunque altro investimento.',
  }

  return {
    key: 'rates',
    title: 'Tassi d’interesse',
    status: `BCE ${ecb.text}, tasso al ${it(ecbLast.value, 2)}%`,
    tone: ecb.phase === 'hiking' ? 'watch' : 'calm',
    summary:
      `La BCE remunera i depositi delle banche al ${it(ecbLast.value, 2)}% ed è ${ecb.text}` +
      (fedLast ? `; la Federal Reserve americana è al ${it(fedLast.value, 2)}%, ${fedPhase.text}.` : '.'),
    whyItMatters: why[ecb.phase],
    indicators: present([
      indicator({ code: 'macro.rates.ecb', title: 'Tasso BCE sui depositi', series: dfr, unit: '%', decimals: 2, source: SRC_ECB, note: moveNote(ecbChange) }),
      indicator({ code: 'macro.rates.fed', title: 'Tasso Fed (limite superiore)', series: fed, unit: '%', decimals: 2, source: SRC_FRED, note: moveNote(fedChange) }),
      indicator({ code: 'macro.rates.us10y', title: 'Titolo di Stato USA a 10 anni', series: us10, unit: '%', decimals: 2, source: SRC_FRED, note: 'quanto rende prestare al governo USA per 10 anni' }),
    ]),
  }
}

async function growthTheme(): Promise<MacroTheme | null> {
  const [eaGdp, usGdpLevels, eaUnemp, usUnemp, sahm] = await Promise.all([
    fetchEcb('MNA', 'Q.Y.I9.W2.S1.S1.B.B1GQ._Z._Z._Z.EUR.LR.GY', 44),
    fetchFred('GDPC1', sinceYears(12)),
    fetchEcb('LFSI', 'M.I9.S.UNEHRT.TOTAL0.15_74.T', 120),
    fetchFred('UNRATE', sinceYears(10)),
    fetchFred('SAHMREALTIME', sinceYears(10)),
  ])
  const usGdp = yoyFromLevels(toQuarterly(usGdpLevels), 4)
  const usUnempM = toMonthly(usUnemp)
  const sahmM = toMonthly(sahm)
  const gdp = last(eaGdp)
  const sahmLast = last(sahm)
  const unemp = last(eaUnemp)
  if (!gdp && !unemp) return null

  const { status, tone } = classifyGrowth(gdp?.value ?? null, sahmLast?.value ?? null)
  const parts: string[] = []
  if (gdp) parts.push(`L’economia dell’area euro ${gdp.value >= 0 ? 'cresce' : 'si contrae'} ${delPct(gdp.value)} su base annua (${periodLabel(gdp.period)})`)
  if (unemp) parts.push(`la disoccupazione è al ${it(unemp.value)}%`)

  return {
    key: 'growth',
    title: 'Crescita e lavoro',
    status,
    tone,
    summary: `${parts.join('; ')}.`,
    whyItMatters: 'Gli utili delle aziende — e quindi le azioni nel lungo periodo — seguono la salute dell’economia. Le borse però anticipano: spesso scendono prima che una recessione sia ufficiale e risalgono prima che finisca.',
    indicators: present([
      indicator({ code: 'macro.growth.ea_gdp', title: 'PIL area euro (variazione annua)', series: eaGdp, unit: '%', decimals: 1, source: SRC_ECB }),
      indicator({ code: 'macro.growth.us_gdp', title: 'PIL Stati Uniti (variazione annua)', series: usGdp, unit: '%', decimals: 1, source: SRC_FRED }),
      indicator({ code: 'macro.growth.ea_unemp', title: 'Disoccupazione area euro', series: eaUnemp, unit: '%', decimals: 1, source: SRC_ECB }),
      indicator({ code: 'macro.growth.us_unemp', title: 'Disoccupazione Stati Uniti', series: usUnempM, unit: '%', decimals: 1, source: SRC_FRED }),
      indicator({ code: 'macro.growth.sahm', title: 'Indicatore di recessione USA (regola di Sahm)', series: sahmM, unit: 'pt', decimals: 2, source: SRC_FRED, note: 'sopra 0,50 ha storicamente coinciso con l’inizio di una recessione' }),
    ]),
  }
}

async function stressTheme(): Promise<MacroTheme | null> {
  const [stl, vix, hy, curve] = await Promise.all([
    fetchFred('STLFSI4', sinceYears(10)),
    fetchFred('VIXCLS', sinceYears(10)),
    fetchFred('BAMLH0A0HYM2', sinceYears(10)),
    fetchFred('T10Y2Y', sinceYears(10)),
  ])
  const stlLast = last(stl)
  const vixLast = last(vix)
  if (!stlLast && !vixLast) return null
  const { status, tone } = classifyStress(stlLast?.value ?? null, vixLast?.value ?? null)

  return {
    key: 'stress',
    title: 'Tensione sui mercati',
    status,
    tone,
    summary:
      (vixLast ? `L’indice VIX, che misura quanta volatilità gli investitori si aspettano sulla borsa USA, è a ${it(vixLast.value)} (sotto 20 = calma, sopra 30 = paura diffusa)` : 'Indice VIX non disponibile') +
      (stlLast ? `; l’indice di stress finanziario della Fed di St. Louis è a ${it(stlLast.value, 2)} (0 = media storica).` : '.'),
    whyItMatters: 'Nei periodi tranquilli i prezzi sono spesso alti e le sorprese negative pesano di più. I picchi di tensione coincidono con cali anche bruschi, ma storicamente sono stati anche i momenti in cui chi investiva con un orizzonte lungo ha comprato a prezzi migliori.',
    indicators: present([
      indicator({ code: 'macro.stress.vix', title: 'Volatilità attesa (VIX)', series: vix, unit: 'pt', decimals: 1, source: SRC_FRED }),
      indicator({ code: 'macro.stress.stlfsi', title: 'Indice di stress finanziario', series: stl, unit: 'pt', decimals: 2, source: SRC_FRED, note: '0 = media storica, valori positivi = più stress' }),
      indicator({ code: 'macro.stress.hy', title: 'Premio chiesto alle aziende più rischiose', series: hy, unit: '%', decimals: 2, source: SRC_FRED, note: 'rendimento extra dei bond “high yield” USA sui titoli di Stato (storico disponibile: 3 anni)' }),
      indicator({ code: 'macro.stress.curve', title: 'Curva dei tassi USA (10 anni − 2 anni)', series: curve, unit: 'pt', decimals: 2, source: SRC_FRED, note: 'sotto zero (“curva invertita”) ha spesso preceduto le recessioni' }),
    ]),
  }
}

async function currencyTheme(): Promise<MacroTheme | null> {
  const eurusd = await fetchEcb('EXR', 'D.USD.EUR.SP00.A', 2600)
  const now = last(eurusd)
  const yearAgo = lagged(eurusd, 256) // ~1 anno di giorni lavorativi
  if (!now) return null
  const chg = yearAgo ? (now.value / yearAgo.value - 1) * 100 : null
  const dir: Direction = chg === null ? 'flat' : chg > 2 ? 'up' : chg < -2 ? 'down' : 'flat'

  return {
    key: 'currency',
    title: 'Euro / dollaro',
    status: dir === 'up' ? 'Euro più forte di un anno fa' : dir === 'down' ? 'Euro più debole di un anno fa' : 'Cambio stabile rispetto a un anno fa',
    tone: 'calm',
    summary:
      `Un euro vale ${it(now.value, 4)} dollari` +
      (chg !== null ? `: ${it(Math.abs(chg))}% ${chg >= 0 ? 'in più' : 'in meno'} rispetto a un anno fa.` : '.'),
    whyItMatters: 'Chi investe dall’Italia in strumenti globali possiede in gran parte attività in dollari (un ETF azionario mondiale è per circa due terzi americano). Se l’euro si rafforza, il loro valore in euro scende a parità di prezzo; se si indebolisce, sale.',
    indicators: present([
      indicator({ code: 'macro.currency.eurusd', title: 'Dollari per un euro', series: eurusd, unit: '$', decimals: 4, source: SRC_ECB, note: chg !== null ? `${chg >= 0 ? '+' : '−'}${it(Math.abs(chg))}% in un anno` : undefined }),
    ]),
  }
}

/** Un costruttore per tema: usati tutti insieme dal refresh, singolarmente dai grafici su richiesta. */
export const MACRO_THEME_BUILDERS: Record<MacroThemeKey, () => Promise<MacroTheme | null>> = {
  inflation: inflationTheme,
  rates:     () => ratesTheme(new Date()),
  growth:    growthTheme,
  stress:    stressTheme,
  currency:  currencyTheme,
}

/**
 * Costruisce il quadro macro. Ogni tema è indipendente: se le sue fonti non
 * rispondono il tema viene omesso (e loggato dagli adapter), senza bloccare gli altri.
 */
export async function buildMacroOverview(): Promise<MacroOverview> {
  const settled = await Promise.allSettled(Object.values(MACRO_THEME_BUILDERS).map((build) => build()))
  const themes: MacroTheme[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled') { if (r.value) themes.push(r.value) }
    else console.error('[market] tema macro fallito:', r.reason)
  }
  return { themes, asOf: Math.floor(Date.now() / 1000) }
}
