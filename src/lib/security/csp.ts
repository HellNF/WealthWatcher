// src/lib/security/csp.ts
//
// Condiviso tra next.config.ts (header di sicurezza) e app/layout.tsx (script
// inline per il tema): tenere qui l'unica fonte di verità del contenuto dello
// script evita di dover ricalcolare a mano l'hash CSP ogni volta che cambia.
//
// Approccio "hash-based" (non nonce-based): l'app resta staticamente
// renderizzabile (nessun forcing a dynamic rendering) — vedi
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md,
// sezione "Without Nonces".
import { createHash } from 'crypto'

// Applica il tema salvato prima del paint, per evitare il flash del tema
// sbagliato. Contenuto letterale del tag <script> inline in app/layout.tsx —
// se lo cambi lì, non serve toccare nulla qui: l'hash si ricalcola da solo.
export const THEME_SCRIPT = `
(function(){
  try {
    var s = localStorage.getItem('ww-theme');
    var dark = s === 'dark' || (!s && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch(e){}
})();
`

/** Restituisce la direttiva CSP `'sha256-...'` per il contenuto esatto di uno script inline. */
export function scriptHash(source: string): string {
  return `'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`
}
