// src/lib/rateLimit.ts
//
// Rate limiting in-memory a finestra fissa. Adatto a un'app self-hosted
// single-processo (SQLite, nessun bilanciamento multi-istanza): lo stato vive
// nel processo Node, niente Redis. Se un giorno l'app girasse multi-istanza,
// questo limiter andrebbe sostituito con uno store condiviso.
interface Bucket {
  count:       number
  windowStart: number
}

const buckets = new Map<string, Bucket>()

// Soglia oltre la quale, alla prossima chiamata, si ripuliscono i bucket
// scaduti — evita una crescita indefinita della Map se le chiavi hanno alta
// cardinalità (es. per IP), senza bisogno di un setInterval in background.
const MAX_BUCKETS = 5_000

export interface RateLimitResult {
  allowed:      boolean
  remaining:    number
  retryAfterMs: number
}

/**
 * Al massimo `limit` chiamate ogni `windowMs` per una data `key` (es.
 * `login:<email>`, `messages:<userId>`, `banking-sync:<userId>`).
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()

  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) {
      if (now - b.windowStart >= windowMs) buckets.delete(k)
    }
  }

  const bucket = buckets.get(key)
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now })
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 }
  }

  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: windowMs - (now - bucket.windowStart) }
  }

  bucket.count += 1
  return { allowed: true, remaining: limit - bucket.count, retryAfterMs: 0 }
}

/** Solo per i test: azzera lo stato tra un caso di test e l'altro. */
export function _resetRateLimitsForTests(): void {
  buckets.clear()
}
