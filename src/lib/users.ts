// src/lib/users.ts — Allowlist gate + user record management.
import { eq } from 'drizzle-orm'
import { db, sqlite } from '@/db'
import { allowedEmails, users } from '@/db/schema'
import type { User } from '@/db/schema'

export type Role = 'admin' | 'member'
export type { User }

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Allowlist gate: only known emails may authenticate (SPEC §2). */
export function getAllowedRole(email: string): Role | null {
  const row = db
    .select({ role: allowedEmails.role })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, normalizeEmail(email)))
    .get()
  return row?.role ?? null
}

export function isEmailAllowed(email: string): boolean {
  return getAllowedRole(email) !== null
}

export function listAllowedEmails(): { email: string; role: Role; note: string | null; created_at: number }[] {
  return db
    .select()
    .from(allowedEmails)
    .orderBy(allowedEmails.created_at)
    .all() as { email: string; role: Role; note: string | null; created_at: number }[]
}

export function addAllowedEmail(email: string, role: Role = 'member'): boolean {
  const norm = normalizeEmail(email)
  if (!norm) return false
  sqlite
    .prepare(`INSERT OR IGNORE INTO allowed_emails (email, role) VALUES (?, ?)`)
    .run(norm, role)
  return true
}

export function removeAllowedEmail(email: string): void {
  sqlite.prepare(`DELETE FROM allowed_emails WHERE email = ?`).run(normalizeEmail(email))
}

export function updateAllowedEmailRole(email: string, role: Role): void {
  sqlite.prepare(`UPDATE allowed_emails SET role = ? WHERE email = ?`).run(role, normalizeEmail(email))
}

export function getUserByEmail(email: string): User | undefined {
  return db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .get()
}

/**
 * Create or refresh the local user record on sign-in. The role always mirrors
 * the allowlist, so promoting/demoting in `allowed_emails` takes effect on the
 * next login. Returns undefined if the email is not allowed.
 */
export function upsertUser(input: {
  email: string
  name?: string | null
  image?: string | null
}): User | undefined {
  const email = normalizeEmail(input.email)
  const role = getAllowedRole(email)
  if (role === null) return undefined

  // COALESCE: preserve existing name/image when the new OAuth value is null.
  // Expressed via raw SQL because Drizzle's onConflictDoUpdate.set doesn't
  // natively support referencing the current row value (COALESCE(excluded.x, x)).
  sqlite
    .prepare(
      `INSERT INTO users (email, name, image, role)
       VALUES (@email, @name, @image, @role)
       ON CONFLICT(email) DO UPDATE SET
         name  = COALESCE(excluded.name, users.name),
         image = COALESCE(excluded.image, users.image),
         role  = excluded.role`,
    )
    .run({ email, name: input.name ?? null, image: input.image ?? null, role })

  return getUserByEmail(email)
}
