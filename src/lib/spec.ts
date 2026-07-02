// src/lib/spec.ts
import fs from 'fs'
import path from 'path'
import { Marked } from 'marked'

export interface Heading {
  level: number
  text: string
  id: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function readSpec(): { html: string; headings: Heading[] } {
  const specPath = path.join(process.cwd(), 'SPEC.md')
  const content = fs.existsSync(specPath)
    ? fs.readFileSync(specPath, 'utf-8')
    : '# WealthWatcher\n\n*Specifiche in elaborazione...*'

  const headings: Heading[] = []

  const localMarked = new Marked()

  localMarked.use({
    walkTokens(token: { type: string; depth: number; text: string }) {
      if (token.type === 'heading' && token.depth <= 3) {
        headings.push({
          level: token.depth,
          text: token.text,
          id: slugify(token.text),
        })
      }
    },
    renderer: {
      heading({ tokens, depth }: { tokens: Array<{ text?: string; raw?: string }>; depth: number }) {
        const text = tokens.map((t) => t.text ?? t.raw ?? '').join('')
        const id = slugify(text)
        return `<h${depth} id="${id}">${text}</h${depth}>\n`
      },
    },
  })

  let html = localMarked.parse(content) as string

  const implementedPhrases = [
    'Auth.js con Google OAuth',
    'Allowlist obbligatoria: OAuth autentica, non autorizza.',
    'Net worth totale — prominente in alto',
    'Breakdown per istituzione — quanto su ogni banca/broker',
    'Grafici andamento — trend storico di net worth e portafogli',
    'Import CSV (1 banca) con dedup robusta + preview, normalizzazione merchant, categorizzazione, report mensile',
    'Normalizzazione counterparty/Merchant (prerequisito)',
    'Report mensile delle uscite con breakdown per merchant e per categoria',
  ]

  for (const phrase of implementedPhrases) {
    html = html.replaceAll(
      phrase,
      `<span class="text-emerald-400 font-semibold">✅</span> ${phrase}`,
    )
  }

  return { html, headings }
}
