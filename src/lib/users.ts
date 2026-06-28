// src/lib/users.ts
import { db } from './db'

export type Role = 'admin' | 'member'

export interface User {
  id: number
  email: string
  name: string | null
  image: string | null
  role: Role
  created_at: number
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Allowlist gate: only known emails may authenticate (SPEC §2). */
export function getAllowedRole(email: string): Role | null {
  const row = db
    .prepare('SELECT role FROM allowed_emails WHERE email = ?')
    .get(normalizeEmail(email)) as { role: Role } | undefined
  return row?.role ?? null
}

export function isEmailAllowed(email: string): boolean {
  return getAllowedRole(email) !== null
}

export function getUserByEmail(email: string): User | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email)) as
    | User
    | undefined
}

/**
 * Create or refresh the local user record on sign-in. The role always mirrors
 * the allowlist, so promoting/demoting in `allowed_emails` takes effect on the
 * next login. Returns undefined if the email is not allowed.
 */
export function upsertUser(input: { email: string; name?: string | null; image?: string | null }):
  | User
  | undefined {
  const email = normalizeEmail(input.email)
  const role = getAllowedRole(email)
  if (role === null) return undefined

  db.prepare(
    `INSERT INTO users (email, name, image, role)
     VALUES (@email, @name, @image, @role)
     ON CONFLICT(email) DO UPDATE SET
       name  = COALESCE(excluded.name, users.name),
       image = COALESCE(excluded.image, users.image),
       role  = excluded.role`,
  ).run({ email, name: input.name ?? null, image: input.image ?? null, role })

  return getUserByEmail(email)
}
