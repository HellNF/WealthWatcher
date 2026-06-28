// src/lib/institutions.ts
import { db } from './db'

export type InstitutionKind = 'bank' | 'broker' | 'both'

export interface Institution {
  id: number
  owner_id: number
  name: string
  kind: InstitutionKind
  created_at: number
}

// An institution is visible to its owner OR to any user it is shared with
// (SPEC §2.1). All reads funnel through this predicate so access control is
// applied uniformly.
const VISIBLE_WHERE = `(
  i.owner_id = @uid
  OR EXISTS (
    SELECT 1 FROM shares s
    WHERE s.entity_type = 'institution' AND s.entity_id = i.id AND s.user_id = @uid
  )
)`

export function listInstitutions(userId: number): Institution[] {
  return db
    .prepare(
      `SELECT i.* FROM institutions i WHERE ${VISIBLE_WHERE}
       ORDER BY i.created_at DESC, i.id DESC`,
    )
    .all({ uid: userId }) as Institution[]
}

export function getInstitutionForUser(userId: number, id: number): Institution | undefined {
  return db
    .prepare(`SELECT i.* FROM institutions i WHERE i.id = @id AND ${VISIBLE_WHERE}`)
    .get({ uid: userId, id }) as Institution | undefined
}

export function createInstitution(
  userId: number,
  name: string,
  kind: InstitutionKind,
): Institution {
  return db
    .prepare(
      `INSERT INTO institutions (owner_id, name, kind) VALUES (?, ?, ?) RETURNING *`,
    )
    .get(userId, name, kind) as Institution
}
