// src/__tests__/lib/fetchWithTimeout.test.ts
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
  jest.restoreAllMocks()
})

test('inoltra input/init a fetch e ne ritorna la response', async () => {
  const mockResponse = new Response('ok', { status: 200 })
  const mockFetch = jest.fn().mockResolvedValue(mockResponse)
  global.fetch = mockFetch as unknown as typeof fetch

  const res = await fetchWithTimeout('https://example.com', { method: 'GET' })

  expect(res).toBe(mockResponse)
  expect(mockFetch).toHaveBeenCalledTimes(1)
  const [url, init] = mockFetch.mock.calls[0]
  expect(url).toBe('https://example.com')
  expect(init.method).toBe('GET')
  expect(init.signal).toBeInstanceOf(AbortSignal)
})

test('aborta la richiesta se supera il timeout', async () => {
  global.fetch = jest.fn((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    })
  }) as unknown as typeof fetch

  await expect(fetchWithTimeout('https://example.com', {}, 10)).rejects.toThrow()
})

test('compone il signal del chiamante con quello di timeout', async () => {
  const mockResponse = new Response('ok')
  const mockFetch = jest.fn().mockResolvedValue(mockResponse)
  global.fetch = mockFetch as unknown as typeof fetch

  const controller = new AbortController()
  await fetchWithTimeout('https://example.com', { signal: controller.signal })

  const [, init] = mockFetch.mock.calls[0]
  expect(init.signal).toBeInstanceOf(AbortSignal)
  expect(init.signal).not.toBe(controller.signal) // combinato, non lo stesso oggetto
})
