import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Geist, Geist_Mono, Bricolage_Grotesque } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { THEME_SCRIPT } from '@/lib/security/csp'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })
// Display: solo titoli di pagina e cifre delle hero — carattere pieno, riconoscibile
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', axes: ['opsz', 'wdth'] })

export const metadata: Metadata = {
  title: 'WealthWatcher',
  description: 'Il tuo patrimonio netto, sempre sotto controllo.',
}

// Mobile: `viewport-fit=cover` disegna fino ai bordi (notch, barra home) e le
// barre fisse si scostano con env(safe-area-inset-*); `resizes-content` fa sì
// che su Android la tastiera rimpicciolisca il layout come su iOS. Lo zoom resta
// libero: gli input a 16px su touch (globals.css) evitano lo zoom automatico.
// theme-color = colore della barra in cima (--surface), uno per tema; se il tema
// scelto nell'app differisce dal sistema lo allinea ThemeProvider.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#0d100e' },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce impostato per-richiesta da src/proxy.ts — necessario per superare
  // la CSP (script-src 'nonce-...') sull'unico script inline dell'app.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable} ${display.variable}`}
    >
      <head>
        {/* suppressHydrationWarning: falso positivo noto — dopo l'inserimento
            nel DOM i browser svuotano deliberatamente l'attributo `nonce`
            quando lo si rilegge (contromisura contro script che lo
            leggerebbero per riusarlo altrove), quindi React vede sempre
            nonce="" lato client contro il valore reale renderizzato dal
            server. Lo script viene comunque eseguito correttamente: il nonce
            è già stato verificato dal browser al parsing, prima che React
            rilegga (e trovi vuoto) l'attributo per il confronto di hydration. */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans antialiased bg-(--bg) text-(--ink) min-h-dvh">
        <ThemeProvider>
          <TooltipProvider>
            <ToastProvider>
              <div className="app-root">{children}</div>
            </ToastProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
