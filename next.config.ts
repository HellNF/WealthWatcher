import type { NextConfig } from "next";
import { THEME_SCRIPT, scriptHash } from "./src/lib/security/csp";

const isDev = process.env.NODE_ENV === "development";

// CSP "senza nonce" (vedi node_modules/next/dist/docs/.../content-security-policy.md):
// mantiene le pagine staticamente renderizzabili. Note sui compromessi:
// - script-src: in produzione solo self + hash dell'unico script inline
//   (tema). In dev niente hash: Turbopack/HMR inietta propri script inline
//   con contenuto non prevedibile (bootstrap, react-refresh) — e per spec
//   CSP, se è presente un hash-source i browser IGNORANO 'unsafe-inline'
//   (serve solo da fallback per browser che non supportano gli hash), quindi
//   "hash + unsafe-inline" non avrebbe permesso quegli script comunque. In
//   dev il server non è il confine di sicurezza, quindi si allenta del tutto.
// - style-src: 'unsafe-inline' perché l'app usa style={{...}} dinamici
//   (grafici, barre di progresso) — niente hash/nonce possibile per stili
//   generati a runtime senza passare a dynamic rendering.
// - img-src: include https: perché le icone crypto (CoinGecko) e le
//   thumbnail delle news (Yahoo Finance) arrivano da domini di terze parti
//   non elencabili in anticipo.
const scriptSrc = isDev
  ? "'self' 'unsafe-inline' 'unsafe-eval'"
  : `'self' ${scriptHash(THEME_SCRIPT)}`;

const cspHeader = `
  default-src 'self';
  script-src ${scriptSrc};
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https:;
  font-src 'self';
  connect-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`
  .replace(/\s{2,}/g, " ")
  .trim();

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS: no-op in dev/http locale, il browser lo onora solo su HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
