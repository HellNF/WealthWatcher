// src/lib/dal.ts
import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

/**
 * Data Access Layer (SPEC §2 / Next.js auth guide). The secure check: every
 * server-side data access goes through `requireUser()` so authorization lives
 * next to the data, not only in the optimistic proxy. `cache` dedupes the
 * session lookup within a single render pass.
 */
export const getSession = cache(async () => auth())

export const requireUser = cache(async () => {
  const session = await getSession()
  if (!session?.uid) redirect('/login')
  return {
    id: session.uid,
    role: session.role,
    name: session.user?.name ?? null,
    email: session.user?.email ?? null,
  }
})
