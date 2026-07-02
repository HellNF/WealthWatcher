// src/types/next-auth.d.ts
import type { Role } from '@/lib/users'

// We expose our own user id/role at the top level of the session rather than
// overriding `session.user.id` (Auth.js types that as `string`, which clashes
// with our numeric DB ids).
declare module 'next-auth' {
  interface Session {
    uid: number
    role: Role
  }
}

// The JWT interface is declared in @auth/core/jwt; next-auth/jwt only re-exports
// it, so the augmentation has to target the source module to merge.
declare module '@auth/core/jwt' {
  interface JWT {
    uid?: number
    role?: Role
  }
}
