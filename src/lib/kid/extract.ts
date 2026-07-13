// KID (Key Information Document) extractor.
// Extracts text from a PDF buffer, then calls OpenAI with structured output to
// parse PRIIP KID fields. Requires the user's own OpenAI API key.
import OpenAI from 'openai'
import { z } from 'zod'

// ── Structured output schema ──────────────────────────────────────────────────

const ConfidenceSchema = z.enum(['low', 'medium', 'high'])

const FieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({ value: valueSchema, confidence: ConfidenceSchema })

const NullableFieldSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({ value: valueSchema.nullable(), confidence: ConfidenceSchema })

export const KidExtractionSchema = z.object({
  name:           FieldSchema(z.string()),           // fund name as on the document
  isin:           NullableFieldSchema(z.string()),   // ISIN code
  currency:       NullableFieldSchema(z.string()),   // trading currency ISO code
  ter:            NullableFieldSchema(z.number()),   // ongoing charges %, e.g. 0.20 (not 0.002)
  entry_cost:     NullableFieldSchema(z.number()),   // one-off entry cost %
  exit_cost:      NullableFieldSchema(z.number()),   // one-off exit cost %
  sri:            NullableFieldSchema(z.number().int().min(1).max(7)), // Summary Risk Indicator
  benchmark:      NullableFieldSchema(z.string()),   // reference index name
  taxation_note:  NullableFieldSchema(z.string()),   // short note on tax treatment
})

export type KidExtraction = z.infer<typeof KidExtractionSchema>

// JSON schema passed to OpenAI response_format — built from the Zod schema structure.
const OPENAI_JSON_SCHEMA = {
  name: 'kid_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      name:          { type: 'object', properties: { value: { type: 'string' }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] } }, required: ['value', 'confidence'], additionalProperties: false },
      isin:          { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] } }, required: ['value', 'confidence'], additionalProperties: false },
      currency:      { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] } }, required: ['value', 'confidence'], additionalProperties: false },
      ter:           { type: 'object', properties: { value: { type: ['number', 'null'] }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] } }, required: ['value', 'confidence'], additionalProperties: false },
      entry_cost:    { type: 'object', properties: { value: { type: ['number', 'null'] }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] } }, required: ['value', 'confidence'], additionalProperties: false },
      exit_cost:     { type: 'object', properties: { value: { type: ['number', 'null'] }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] } }, required: ['value', 'confidence'], additionalProperties: false },
      sri:           { type: 'object', properties: { value: { type: ['integer', 'null'] }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] } }, required: ['value', 'confidence'], additionalProperties: false },
      benchmark:     { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] } }, required: ['value', 'confidence'], additionalProperties: false },
      taxation_note: { type: 'object', properties: { value: { type: ['string', 'null'] }, confidence: { type: 'string', enum: ['low', 'medium', 'high'] } }, required: ['value', 'confidence'], additionalProperties: false },
    },
    required: ['name', 'isin', 'currency', 'ter', 'entry_cost', 'exit_cost', 'sri', 'benchmark', 'taxation_note'],
    additionalProperties: false,
  },
} as const

const SYSTEM_PROMPT = `Sei un assistente specializzato nell'analisi di documenti KID (Key Information Document) per prodotti finanziari PRIIP (fondi, ETF, OICVM).
Estrai i seguenti campi dal testo del KID e restituisci un JSON strutturato. Per ogni campo indica anche la confidenza dell'estrazione (low/medium/high).

Regole:
- TER/ongoing charges: esprimi come percentuale numerica (es. 0.20 per 0.20%, NON 0.002)
- entry_cost/exit_cost: percentuale numerica one-off (es. 3.0 per 3%)
- sri: intero da 1 a 7 (Summary Risk Indicator / indicatore di rischio sintetico)
- Se un campo non è presente nel documento, usa null per value e "low" per confidence
- isin: solo il codice (es. "IE00B4L5Y983"), senza prefissi`

// ── PDF text extraction ───────────────────────────────────────────────────────

export async function extractKidText(buffer: Buffer): Promise<string> {
  const { getDocumentProxy, extractText } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { text } = await extractText(pdf, { mergePages: true })
  return text
}

// ── LLM extraction ────────────────────────────────────────────────────────────

export type KidExtractionResult =
  | { ok: true;  data: KidExtraction; model: string }
  | { ok: false; error: string }

export async function extractKidData(
  text: string,
  apiKey: string,
): Promise<KidExtractionResult> {
  if (!apiKey) return { ok: false, error: 'Chiave API OpenAI mancante' }
  if (text.trim().length < 50) return { ok: false, error: 'Il testo estratto dal PDF è troppo breve — il file potrebbe essere una scansione non leggibile' }

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

  try {
    const client = new OpenAI({ apiKey })
    const response = await client.chat.completions.create({
      model,
      response_format: {
        type: 'json_schema',
        json_schema: OPENAI_JSON_SCHEMA,
      },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: `Testo del KID:\n\n${text.slice(0, 8000)}` },
      ],
      temperature: 0,
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) return { ok: false, error: 'Risposta vuota dal modello LLM' }

    const parsed = KidExtractionSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      console.error('[KID] Zod validation failed:', parsed.error.issues)
      return { ok: false, error: 'Il modello ha restituito dati in formato non valido' }
    }

    return { ok: true, data: parsed.data, model }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Non logghiamo il messaggio grezzo del provider: può includere frammenti
    // della chiave API (utente) o del contenuto della richiesta. Solo una
    // categoria dell'errore, sufficiente per il debug.
    const category = msg.includes('401') || msg.includes('Incorrect API key')
      ? 'auth'
      : msg.includes('429')
      ? 'rate-limit'
      : 'other'
    console.error(`[KID] OpenAI error (${category})`)
    if (msg.includes('401') || msg.includes('Incorrect API key')) {
      return { ok: false, error: 'Chiave API OpenAI non valida o scaduta' }
    }
    if (msg.includes('429')) {
      return { ok: false, error: 'Limite di rate OpenAI raggiunto — riprova tra qualche secondo' }
    }
    return { ok: false, error: `Errore OpenAI: ${msg}` }
  }
}
