import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { THEME_SCRIPT } from '@/lib/security/csp'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'WealthWatcher',
  description: 'Il tuo patrimonio netto, sempre sotto controllo.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce impostato per-richiesta da src/proxy.ts — necessario per superare
  // la CSP (script-src 'nonce-...') sull'unico script inline dell'app.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable}`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="font-sans antialiased bg-[--bg] text-[--ink] min-h-screen">
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
