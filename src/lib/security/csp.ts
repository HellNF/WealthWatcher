// src/lib/security/csp.ts
//
// Contenuto dell'unico script inline dell'app (applica il tema salvato prima
// del paint, per evitare il flash del tema sbagliato). Fonte di verità
// condivisa con app/layout.tsx, che lo renderizza con l'attributo `nonce`
// letto dall'header impostato in src/proxy.ts.
//
// La CSP è nonce-based (non hash-based): Next.js App Router inietta propri
// script inline per l'hydration (payload RSC/self.__next_f, contenuto
// diverso a ogni render) che non si possono "hashare" in anticipo — un CSP a
// hash statico blocca quegli script e rompe l'app. Il nonce, generato per
// richiesta nel proxy, viene invece propagato automaticamente da Next.js a
// tutti gli script che genera lui stesso (vedi
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
export const THEME_SCRIPT = `
(function(){
  try {
    var s = localStorage.getItem('ww-theme');
    var dark = s === 'dark' || (!s && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch(e){}
})();
`
