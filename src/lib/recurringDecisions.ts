// src/lib/recurringDecisions.ts — Conferme e scarti dei pagamenti ricorrenti.
//
// Il rilevamento (detectRecurring) resta automatico; queste decisioni lo
// correggono: un ricorrente scartato non viene più mostrato né usato da
// scadenziario, previsioni e suggerimenti; uno confermato viene segnato come tale.
import { sqlite } from '@/db'

export type RecurringDecision = 'confirmed' | 'dismissed'

const KEY_PATTERN = /^[md]:[\s\S]{1,200}$/

export function isValidRecurringKey(key: unknown): key is string {
  return typeof key === 'string' && KEY_PATTERN.test(key)
}

export function listRecurringDecisions(userId: number): Map<string, { status: RecurringDecision; label: string }> {
  const rows = sqlite.prepare(
    'SELECT key, label, status FROM recurring_decisions WHERE owner_id = ? ORDER BY created_at DESC, id DESC',
  ).all(userId) as { key: string; label: string; status: RecurringDecision }[]
  return new Map(rows.map((r) => [r.key, { status: r.status, label: r.label }]))
}

export function setRecurringDecision(userId: number, key: string, label: string, status: RecurringDecision): void {
  sqlite.prepare(
    `INSERT INTO recurring_decisions (owner_id, key, label, status) VALUES (?, ?, ?, ?)
     ON CONFLICT (owner_id, key) DO UPDATE SET status = excluded.status, label = excluded.label`,
  ).run(userId, key, label.slice(0, 200), status)
}

/** Toglie la decisione: il ricorrente torna una proposta da valutare. */
export function clearRecurringDecision(userId: number, key: string): void {
  sqlite.prepare('DELETE FROM recurring_decisions WHERE owner_id = ? AND key = ?').run(userId, key)
}
