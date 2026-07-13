// src/lib/security/redirect.ts
//
// Valida un `callbackUrl` prima di usarlo come redirect post-login. Un
// semplice `startsWith('/')` non basta: `//evil.com` inizia per '/' ma un
// browser lo interpreta come URL protocol-relative (stesso schema della
// pagina corrente, host = evil.com) — open redirect. Anche `/\evil.com` è
// pericoloso: alcuni browser normalizzano il backslash in slash prima di
// risolvere l'URL, ottenendo lo stesso effetto.
export function isSafeRedirectPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')
}
