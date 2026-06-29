// src/lib/accounts.ts — BankAccount repository.
// Ownership access mirrors src/lib/institutions.ts: owner OR explicit share.
import { and, desc, eq, exists, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { bankAccounts, shares } from '@/db/schema'
import type { BankAccount } from '@/db/schema'

export type { BankAccount }

/**
 * Visibility predicate: account visible to its owner OR to any user it is
 * explicitly shared with (SPEC §2.1). Mirrors the pattern in institutions.ts.
 */
function visibleTo(userId: number) {
  return or(
    eq(bankAccounts.owner_id, userId),
    exists(
      db
        .select({ _: sql<number>`1` })
        .from(shares)
        .where(
          and(
            eq(shares.entity_type, 'bank_account'),
            eq(shares.entity_id, bankAccounts.id),
            eq(shares.user_id, userId),
          ),
        ),
    ),
  )
}

export function listAccounts(userId: number, institutionId?: number): BankAccount[] {
  const baseWhere = visibleTo(userId)
  const where = institutionId !== undefined
    ? and(baseWhere, eq(bankAccounts.institution_id, institutionId))
    : baseWhere
  return db
    .select()
    .from(bankAccounts)
    .where(where)
    .orderBy(desc(bankAccounts.created_at), desc(bankAccounts.id))
    .all()
}

export function getAccountForUser(userId: number, id: number): BankAccount | undefined {
  return db
    .select()
    .from(bankAccounts)
    .where(and(eq(bankAccounts.id, id), visibleTo(userId)))
    .get()
}

export function createAccount(
  userId: number,
  institutionId: number,
  name: string,
  currency: string,
): BankAccount {
  const row = db
    .insert(bankAccounts)
    .values({ owner_id: userId, institution_id: institutionId, name, currency })
    .returning()
    .get()
  return row as BankAccount
}
