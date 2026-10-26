// src/lib/accountMerge.ts — Fusione di due bank_accounts che sono lo stesso
// conto reale, e riconoscimento automatico dei doppioni nati dal rinnovo di
// un consenso Open Banking (prima che linkOrCreateAccount ricollegasse i conti
// per chiave stabile, ogni rinnovo creava un conto nuovo e spezzava lo storico).
//
// Riceve la connessione SQLite come parametro invece di importare '@/db': gira
// anche all'avvio, dentro initDb (src/db/index.ts), subito dopo le migrazioni.
import type Database from 'better-sqlite3'
import type { BankAccount } from '@/db/schema'

export interface MergeAccountsResult {
  movedCount:     number   // movimenti spostati nel conto che resta
  duplicateCount: number   // movimenti già presenti (stesso dedup_hash), scartati
}

/**
 * Fonde `absorbId` dentro `keepId`. Il conto che resta conserva id, nome e
 * storico; riceve i movimenti dell'altro (quelli già presenti per dedup_hash
 * vengono scartati), il collegamento Open Banking più recente e il saldo di
 * riferimento più aggiornato. L'altro conto viene eliminato. Solo il
 * proprietario può fondere, e solo conti della stessa istituzione e valuta.
 * Ritorna null se i conti non sono fondibili.
 */
export function mergeAccountsIn(
  sqlite:   Database.Database,
  userId:   number,
  keepId:   number,
  absorbId: number,
): MergeAccountsResult | null {
  if (keepId === absorbId) return null
  const load = sqlite.prepare(
    `SELECT a.*, c.status AS connection_status
       FROM bank_accounts a LEFT JOIN eb_connections c ON c.id = a.eb_connection_id
      WHERE a.id = ? AND a.owner_id = ?`,
  )
  type Row = BankAccount & { connection_status: string | null }
  const keep   = load.get(keepId, userId) as Row | undefined
  const absorb = load.get(absorbId, userId) as Row | undefined
  if (!keep || !absorb) return null
  if (keep.institution_id !== absorb.institution_id || keep.currency !== absorb.currency) return null

  return sqlite.transaction((): MergeAccountsResult => {
    const total = (sqlite.prepare(`SELECT COUNT(*) AS n FROM transactions WHERE bank_account_id = ?`).get(absorbId) as { n: number }).n
    // OR IGNORE: le righe che violerebbero UNIQUE(bank_account_id, dedup_hash)
    // restano sul conto assorbito e spariscono con lui (ON DELETE CASCADE).
    const moved = sqlite
      .prepare(`UPDATE OR IGNORE transactions SET bank_account_id = ? WHERE bank_account_id = ?`)
      .run(keepId, absorbId).changes
    sqlite.prepare(`UPDATE import_batches SET bank_account_id = ? WHERE bank_account_id = ?`).run(keepId, absorbId)
    sqlite.prepare(`UPDATE mortgages SET associated_account_id = ? WHERE associated_account_id = ?`).run(keepId, absorbId)
    sqlite
      .prepare(`UPDATE OR IGNORE shares SET entity_id = ? WHERE entity_type = 'bank_account' AND entity_id = ?`)
      .run(keepId, absorbId)
    sqlite.prepare(`DELETE FROM shares WHERE entity_type = 'bank_account' AND entity_id = ?`).run(absorbId)

    // Collegamento Open Banking: vince la connessione attiva; a parità, la più recente.
    const linkScore = (a: Row) => [a.connection_status === 'active' ? 1 : 0, a.eb_connection_id ?? 0]
    const [ka, kb] = linkScore(keep)
    const [aa, ab] = linkScore(absorb)
    const link = aa > ka || (aa === ka && ab > kb) ? absorb : keep
    // Saldo di riferimento: il più recente fra i due.
    const anchor = (absorb.anchor_date ?? '') > (keep.anchor_date ?? '') ? absorb : keep

    // L'uid è legato alla connessione: va liberato sul conto assorbito prima di
    // spostarlo, così non restano per un istante due conti con lo stesso link.
    sqlite.prepare(`UPDATE bank_accounts SET eb_account_uid = NULL, eb_connection_id = NULL WHERE id = ?`).run(absorbId)
    sqlite
      .prepare(
        `UPDATE bank_accounts
            SET eb_account_uid = ?, eb_connection_id = ?, eb_account_key = ?,
                anchor_balance_minor = ?, anchor_date = ?, interest_rate = ?
          WHERE id = ?`,
      )
      .run(
        link.eb_account_uid, link.eb_connection_id, keep.eb_account_key ?? absorb.eb_account_key,
        anchor.anchor_balance_minor, anchor.anchor_date, keep.interest_rate ?? absorb.interest_rate,
        keepId,
      )
    sqlite.prepare(`DELETE FROM bank_accounts WHERE id = ?`).run(absorbId)

    return { movedCount: moved, duplicateCount: total - moved }
  })()
}

export interface RenewalMerge {
  ownerId:  number
  keptId:   number   // conto originale, con lo storico
  mergedId: number   // doppione creato dal rinnovo, ora eliminato
  result:   MergeAccountsResult
}

// Sotto questa soglia la sovrapposizione potrebbe essere una coincidenza (due
// conti diversi con un singolo movimento identico è improbabile ma possibile),
// salvo che il doppione abbia in tutto meno movimenti di così.
const MIN_SHARED_TXNS = 3

/**
 * Riconosce e fonde i doppioni nati dal rinnovo di un consenso Open Banking.
 * Una coppia (originale, doppione) è lo stesso conto se:
 *  - stesso proprietario, istituzione e valuta;
 *  - il doppione è collegato a una connessione attiva, l'originale era
 *    collegato via Open Banking (ha un uid) a una connessione non più attiva;
 *  - l'identità è provata: stessa chiave stabile (identification_hash/IBAN),
 *    oppure movimenti identici in comune (stesso dedup_hash: per Open Banking
 *    deriva dal riferimento univoco del movimento fornito dalla banca), senza
 *    chiavi stabili diverse a smentirla;
 *  - l'abbinamento è univoco in entrambe le direzioni: nel dubbio non si
 *    fonde niente e resta la fusione manuale dalla pagina del conto.
 * Il conto originale resta (id, nome, storico) e prende il collegamento attivo.
 */
export function autoMergeRenewalDuplicates(sqlite: Database.Database, ownerId?: number): RenewalMerge[] {
  const pairs = sqlite
    .prepare(
      `SELECT n.owner_id AS ownerId, o.id AS oldId, n.id AS newId,
              (o.eb_account_key IS NOT NULL AND o.eb_account_key = n.eb_account_key) AS sameKey,
              (SELECT COUNT(*) FROM transactions tn
                 JOIN transactions tod ON tod.bank_account_id = o.id AND tod.dedup_hash = tn.dedup_hash
                WHERE tn.bank_account_id = n.id) AS shared,
              (SELECT COUNT(*) FROM transactions WHERE bank_account_id = n.id) AS newCount
         FROM bank_accounts n
         JOIN eb_connections cn ON cn.id = n.eb_connection_id AND cn.status = 'active'
         JOIN bank_accounts o
           ON o.owner_id = n.owner_id AND o.institution_id = n.institution_id
          AND o.currency = n.currency AND o.id < n.id
         LEFT JOIN eb_connections co ON co.id = o.eb_connection_id
        WHERE o.eb_account_uid IS NOT NULL
          AND (co.id IS NULL OR co.status <> 'active')
          AND NOT (o.eb_account_key IS NOT NULL AND n.eb_account_key IS NOT NULL AND o.eb_account_key <> n.eb_account_key)
          AND (? IS NULL OR n.owner_id = ?)`,
    )
    .all(ownerId ?? null, ownerId ?? null) as {
      ownerId: number; oldId: number; newId: number; sameKey: number; shared: number; newCount: number
    }[]

  const proven = pairs.filter((p) => p.sameKey === 1 || (p.shared > 0 && p.shared >= Math.min(MIN_SHARED_TXNS, p.newCount)))

  const count = (key: 'oldId' | 'newId', id: number) => proven.filter((p) => p[key] === id).length
  const unambiguous = proven.filter((p) => count('oldId', p.oldId) === 1 && count('newId', p.newId) === 1)

  const merged: RenewalMerge[] = []
  for (const p of unambiguous) {
    const result = mergeAccountsIn(sqlite, p.ownerId, p.oldId, p.newId)
    if (result) merged.push({ ownerId: p.ownerId, keptId: p.oldId, mergedId: p.newId, result })
  }
  return merged
}
