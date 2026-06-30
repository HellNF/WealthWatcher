// KID extraction tests — OpenAI mocked; extractKidText is a thin unpdf wrapper not tested here.
jest.mock('openai')

import OpenAI from 'openai'
import { extractKidData, type KidExtraction } from '@/lib/kid/extract'

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_RESPONSE: KidExtraction = {
  name:          { value: 'iShares Core MSCI World UCITS ETF', confidence: 'high' },
  isin:          { value: 'IE00B4L5Y983', confidence: 'high' },
  currency:      { value: 'USD', confidence: 'high' },
  ter:           { value: 0.20, confidence: 'high' },
  entry_cost:    { value: 0, confidence: 'medium' },
  exit_cost:     { value: 0, confidence: 'medium' },
  sri:           { value: 4, confidence: 'high' },
  benchmark:     { value: 'MSCI World Index', confidence: 'high' },
  taxation_note: { value: null, confidence: 'low' },
}

function mockOpenAiResponse(content: string) {
  const MockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>
  MockOpenAI.mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content } }],
        }),
      },
    },
  }) as unknown as OpenAI)
}

// ── extractKidData ────────────────────────────────────────────────────────────

describe('extractKidData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns structured data from a valid LLM response', async () => {
    mockOpenAiResponse(JSON.stringify(VALID_RESPONSE))
    const result = await extractKidData('Testo di un KID con informazioni sufficienti per estrarre i dati strutturati richiesti.', 'sk-valid-key')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.name.value).toBe('iShares Core MSCI World UCITS ETF')
    expect(result.data.isin.value).toBe('IE00B4L5Y983')
    expect(result.data.ter.value).toBe(0.20)
    expect(result.data.sri.value).toBe(4)
    expect(result.model).toBeTruthy()
  })

  test('confidence fields are present for all keys', async () => {
    mockOpenAiResponse(JSON.stringify(VALID_RESPONSE))
    const result = await extractKidData('Testo KID sufficiente per test di estrazione strutturata dei dati.', 'sk-key')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const key of ['name', 'isin', 'currency', 'ter', 'entry_cost', 'exit_cost', 'sri'] as const) {
      expect(['low', 'medium', 'high']).toContain(result.data[key].confidence)
    }
  })

  test('returns error if api key is missing', async () => {
    const result = await extractKidData('some text', '')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/chiave/i)
  })

  test('returns error if text is too short', async () => {
    const result = await extractKidData('Corto', 'sk-key')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/breve|scansione/i)
  })

  test('returns error if LLM response is malformed JSON', async () => {
    mockOpenAiResponse('not valid json {{{{')
    const result = await extractKidData('Testo KID abbastanza lungo da superare il controllo minimo di lunghezza.', 'sk-key')
    expect(result.ok).toBe(false)
  })

  test('returns error if LLM response fails schema validation', async () => {
    mockOpenAiResponse(JSON.stringify({ unexpected: 'shape', foo: 'bar' }))
    const result = await extractKidData('Testo KID abbastanza lungo da superare il controllo minimo di lunghezza.', 'sk-key')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/formato/i)
  })

  test('handles OpenAI 401 with clear message', async () => {
    const MockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>
    MockOpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('401 Incorrect API key provided')),
        },
      },
    }) as unknown as OpenAI)
    const result = await extractKidData('Testo KID abbastanza lungo da superare il controllo minimo di lunghezza.', 'sk-wrong')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/non valida|scaduta/i)
  })
})

