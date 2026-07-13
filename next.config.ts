import type { NextConfig } from "next";

// La Content-Security-Policy è impostata in src/proxy.ts (non qui): richiede
// un nonce fresco per richiesta, che next.config.ts — valutato una sola volta
// al build/avvio — non può generare. Gli header sotto sono invece statici,
// identici per ogni risposta, e restano qui.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS: innocuo se l'istanza è servita in HTTP puro — per spec i browser
  // ignorano questo header quando non arriva su una connessione già HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
