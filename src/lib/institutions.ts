// src/lib/institutions.ts — Institution repository (banks, brokers).
import { and, desc, eq, exists, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { institutions, shares } from '@/db/schema'
import type { Institution } from '@/db/schema'

export type InstitutionKind = 'bank' | 'broker' | 'both'
export type { Institution }

/**
 * Visibility predicate: institution visible to its owner OR to any user it is
 * explicitly shared with (SPEC §2.1). All reads funnel through here so access
 * control is applied uniformly — no scattered WHERE clauses.
 */
function visibleTo(userId: number) {
  return or(
    eq(institutions.owner_id, userId),
    exists(
      db
        .select({ _: sql<number>`1` })
        .from(shares)
        .where(
          and(
            eq(shares.entity_type, 'institution'),
            // Correlated reference to the outer institutions.id:
            eq(shares.entity_id, institutions.id),
            eq(shares.user_id, userId),
          ),
        ),
    ),
  )
}

export function listInstitutions(userId: number): Institution[] {
  return db
    .select()
    .from(institutions)
    .where(visibleTo(userId))
    .orderBy(desc(institutions.created_at), desc(institutions.id))
    .all()
}

export function getInstitutionForUser(userId: number, id: number): Institution | undefined {
  return db
    .select()
    .from(institutions)
    .where(and(eq(institutions.id, id), visibleTo(userId)))
    .get()
}

export function createInstitution(userId: number, name: string, kind: InstitutionKind): Institution {
  const row = db
    .insert(institutions)
    .values({ owner_id: userId, name, kind })
    .returning()
    .get()
  // SQLite INSERT RETURNING * always returns the row on success; the cast is safe.
  return row as Institution
}
