// src/lib/providers.ts — Catalogo delle banche/provider conosciuti.
// `parser` = chiave in PARSERS (src/lib/import/registry.ts) se l'import dello
// estratto conto è supportato, altrimenti null. Le istituzioni "custom"
// (provider = null) non hanno import automatico.
export type InstitutionKind = 'bank' | 'broker' | 'both'

export interface BankProvider {
  id:          string
  name:        string
  defaultKind: InstitutionKind
  parser:      string | null
}

export const PROVIDERS: BankProvider[] = [
  // Con parser estratto conto
  { id: 'intesa',         name: 'Intesa Sanpaolo',            defaultKind: 'bank',   parser: 'intesa_xlsx' },
  { id: 'bbva',           name: 'BBVA',                       defaultKind: 'bank',   parser: 'bbva_xlsx' },
  // Predefiniti senza parser (import non ancora supportato)
  { id: 'paypal',         name: 'PayPal',                     defaultKind: 'bank',   parser: null },
  { id: 'revolut',        name: 'Revolut',                    defaultKind: 'both',   parser: null },
  { id: 'n26',            name: 'N26',                        defaultKind: 'bank',   parser: null },
  { id: 'trade_republic', name: 'Trade Republic',             defaultKind: 'both',   parser: null },
  { id: 'fineco',         name: 'Fineco',                     defaultKind: 'both',   parser: null },
  { id: 'unicredit',      name: 'UniCredit',                  defaultKind: 'bank',   parser: null },
  { id: 'bancoposta',     name: 'BancoPosta / Poste Italiane', defaultKind: 'bank',  parser: null },
  { id: 'ing',            name: 'ING',                        defaultKind: 'bank',   parser: null },
  { id: 'bper',           name: 'BPER Banca',                 defaultKind: 'bank',   parser: null },
  { id: 'credit_agricole', name: 'Crédit Agricole',           defaultKind: 'bank',   parser: null },
  { id: 'mediolanum',     name: 'Banca Mediolanum',           defaultKind: 'both',   parser: null },
  { id: 'hype',           name: 'Hype',                       defaultKind: 'bank',   parser: null },
  { id: 'widiba',         name: 'Widiba',                     defaultKind: 'both',   parser: null },
]

export function getProvider(id: string | null | undefined): BankProvider | undefined {
  if (!id) return undefined
  return PROVIDERS.find((p) => p.id === id)
}

/** Chiave parser per il provider di un'istituzione, o null se non supportato. */
export function providerParser(id: string | null | undefined): string | null {
  return getProvider(id)?.parser ?? null
}
