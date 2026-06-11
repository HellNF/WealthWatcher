# WealthWatcher Spec-Sharing Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire un sito Next.js 15 che mostra `SPEC.md` renderizzato e una chat di gruppo per proporre modifiche, containerizzato con Docker per deploy su Proxmox.

**Architecture:** Next.js 15 App Router con Server Components per lo spec viewer e Client Components per la chat. SQLite tramite `better-sqlite3` per i messaggi, singleton istanziato all'avvio. Polling ogni 10 secondi per nuovi messaggi via GET `/api/messages?since=<unix>`.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS v4, `better-sqlite3`, `marked`, Jest, `@testing-library/react`, Docker

---

## File Structure

```
/
├── SPEC.md                              ← documento spec, editato via git
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── data/
│   └── .gitkeep                         ← volume Docker per chat.db
├── src/
│   ├── app/
│   │   ├── layout.tsx                   ← root layout dark mode
│   │   ├── page.tsx                     ← homepage: SpecViewer + Chat
│   │   ├── globals.css
│   │   └── api/
│   │       └── messages/
│   │           └── route.ts             ← GET + POST messaggi
│   ├── components/
│   │   ├── SpecViewer.tsx               ← server component, renderizza HTML
│   │   ├── SpecSidebar.tsx              ← sticky TOC, client component
│   │   ├── ChatBubble.tsx               ← singola bolla messaggio
│   │   ├── ChatFeed.tsx                 ← lista bolle con polling (client)
│   │   └── ChatForm.tsx                 ← form invio messaggio (client)
│   └── lib/
│       ├── db.ts                        ← connessione SQLite + schema init
│       ├── messages.ts                  ← query: getMessages, insertMessage
│       └── spec.ts                      ← legge SPEC.md → { html, headings }
├── src/__tests__/
│   ├── lib/
│   │   ├── messages.test.ts
│   │   └── spec.test.ts
│   └── api/
│       └── messages.test.ts
├── jest.config.ts
└── jest.env.ts                          ← DATABASE_PATH=:memory: per i test
```

---

## Task 1: Scaffolding progetto Next.js

**Files:**
- Crea: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `jest.config.ts`, `jest.env.ts`
- Modifica: `.gitignore`

- [ ] **Step 1: Scaffold Next.js nella directory corrente**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --yes
```

Rispondere `y` se chiede di sovrascrivere `README.md`.

- [ ] **Step 2: Installa dipendenze runtime**

```bash
npm install better-sqlite3 marked
```

- [ ] **Step 3: Installa dipendenze di sviluppo e test**

```bash
npm install -D @types/better-sqlite3 @types/marked jest jest-environment-node @testing-library/react @testing-library/jest-dom ts-jest ts-node
```

- [ ] **Step 4: Crea `jest.env.ts`** — imposta env var PRIMA che i moduli vengano importati

```typescript
// jest.env.ts
process.env.DATABASE_PATH = ':memory:'
```

- [ ] **Step 5: Crea `jest.config.ts`**

```typescript
// jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  setupFiles: ['<rootDir>/jest.env.ts'],
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
}

export default createJestConfig(config)
```

- [ ] **Step 6: Crea `jest.setup.ts`**

```typescript
// jest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Aggiungi `data/` a `.gitignore` e crea il placeholder**

Nel `.gitignore` aggiungi in fondo:
```
# SQLite data
/data/*.db
```

```bash
mkdir -p data && echo "" > data/.gitkeep
```

- [ ] **Step 8: Aggiungi script test a `package.json`**

Nel file `package.json` già creato, verifica che ci sia `"test": "jest"`. Se manca, aggiungilo nella sezione `scripts`:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 project with Jest and dependencies"
```

---

## Task 2: Layer database — `db.ts` e `messages.ts`

**Files:**
- Crea: `src/lib/db.ts`
- Crea: `src/lib/messages.ts`
- Crea: `src/__tests__/lib/messages.test.ts`

- [ ] **Step 1: Scrivi il test fallente**

```typescript
// src/__tests__/lib/messages.test.ts
import { db } from '@/lib/db'
import { getMessages, insertMessage } from '@/lib/messages'

beforeEach(() => {
  db.exec('DELETE FROM messages')
})

test('getMessages restituisce array vuoto se non ci sono messaggi', () => {
  const result = getMessages()
  expect(result).toEqual([])
})

test('insertMessage salva e restituisce il messaggio', () => {
  const msg = insertMessage('Mario', 'Proposta di test')
  expect(msg.id).toBeDefined()
  expect(msg.author).toBe('Mario')
  expect(msg.content).toBe('Proposta di test')
  expect(msg.created_at).toBeGreaterThan(0)
})

test('getMessages restituisce tutti i messaggi in ordine cronologico', () => {
  insertMessage('Mario', 'Primo')
  insertMessage('Nicol', 'Secondo')
  const messages = getMessages()
  expect(messages).toHaveLength(2)
  expect(messages[0].content).toBe('Primo')
  expect(messages[1].content).toBe('Secondo')
})

test('getMessages con since filtra messaggi più vecchi', () => {
  const m1 = insertMessage('Mario', 'Vecchio')
  insertMessage('Nicol', 'Nuovo')
  const messages = getMessages(m1.created_at)
  expect(messages).toHaveLength(1)
  expect(messages[0].content).toBe('Nuovo')
})
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

```bash
npm test -- --testPathPattern=messages.test.ts
```

Atteso: `Cannot find module '@/lib/db'`

- [ ] **Step 3: Crea `src/lib/db.ts`**

```typescript
// src/lib/db.ts
import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

function initDb(): Database.Database {
  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'data', 'chat.db')

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  }

  const db = new Database(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      author     TEXT    NOT NULL CHECK(length(author) <= 50),
      content    TEXT    NOT NULL CHECK(length(content) <= 1000),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `)
  return db
}

export const db = initDb()
```

- [ ] **Step 4: Crea `src/lib/messages.ts`**

```typescript
// src/lib/messages.ts
import { db } from './db'

export interface Message {
  id: number
  author: string
  content: string
  created_at: number
}

export function getMessages(since?: number): Message[] {
  if (since !== undefined) {
    return db
      .prepare('SELECT * FROM messages WHERE created_at > ? ORDER BY created_at ASC')
      .all(since) as Message[]
  }
  return db.prepare('SELECT * FROM messages ORDER BY created_at ASC').all() as Message[]
}

export function insertMessage(author: string, content: string): Message {
  return db
    .prepare('INSERT INTO messages (author, content) VALUES (?, ?) RETURNING *')
    .get(author, content) as Message
}
```

- [ ] **Step 5: Esegui i test per verificare che passino**

```bash
npm test -- --testPathPattern=messages.test.ts
```

Atteso: `4 passed`

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/lib/messages.ts src/__tests__/lib/messages.test.ts jest.config.ts jest.env.ts jest.setup.ts
git commit -m "feat: add SQLite database layer with messages queries"
```

---

## Task 3: Parser spec — `spec.ts` e `SPEC.md`

**Files:**
- Crea: `src/lib/spec.ts`
- Crea: `SPEC.md`
- Crea: `src/__tests__/lib/spec.test.ts`

- [ ] **Step 1: Scrivi il test fallente**

```typescript
// src/__tests__/lib/spec.test.ts
import { readSpec } from '@/lib/spec'

test('readSpec restituisce html e headings', () => {
  const { html, headings } = readSpec()
  expect(typeof html).toBe('string')
  expect(html.length).toBeGreaterThan(0)
  expect(Array.isArray(headings)).toBe(true)
})

test('readSpec estrae heading H1 come primo elemento', () => {
  const { headings } = readSpec()
  expect(headings[0].level).toBe(1)
  expect(headings[0].id).toBeTruthy()
})

test('readSpec genera id slug validi senza caratteri speciali', () => {
  const { headings } = readSpec()
  for (const h of headings) {
    expect(h.id).toMatch(/^[a-z0-9-]+$/)
  }
})
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

```bash
npm test -- --testPathPattern=spec.test.ts
```

Atteso: `Cannot find module '@/lib/spec'`

- [ ] **Step 3: Crea `src/lib/spec.ts`**

```typescript
// src/lib/spec.ts
import fs from 'fs'
import path from 'path'
import { marked, Renderer } from 'marked'

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
    .trim()
}

export function readSpec(): { html: string; headings: Heading[] } {
  const specPath = path.join(process.cwd(), 'SPEC.md')
  const content = fs.existsSync(specPath)
    ? fs.readFileSync(specPath, 'utf-8')
    : '# WealthWatcher\n\n*Specifiche in elaborazione...*'

  const headings: Heading[] = []

  const renderer = new Renderer()
  renderer.heading = ({ text, depth }) => {
    const id = slugify(text)
    if (depth <= 3) headings.push({ level: depth, text, id })
    return `<h${depth} id="${id}">${text}</h${depth}>\n`
  }

  marked.use({ renderer })
  const html = marked.parse(content) as string

  return { html, headings }
}
```

- [ ] **Step 4: Crea `SPEC.md` con il contenuto iniziale**

```markdown
# WealthWatcher — Specifiche

> Documento vivente. Proponi modifiche tramite la chat qui sotto.

## 1. Vision

WealthWatcher è un gestore patrimoniale personale self-hosted che aggrega conti bancari e portafogli di investimento in un'unica interfaccia web.

## 2. Utenti

- Target: friends & family (gruppo chiuso, ~10 persone max)
- Autenticazione: Auth.js con Google OAuth (gratuito, self-hosted)
- Dati isolati per utente — ogni persona vede solo i propri dati
- Feature futura: conti condivisi (es. spese di coppia)

## 3. Struttura Entità

```
Institution (banca/broker)
├── BankAccount (0+)           ← conto corrente, risparmio
│   └── Transaction (n)
└── InvestmentPortfolio (0+)   ← conto trading
    └── Holding (n)            ← singolo strumento finanziario
```

Un'istituzione può avere sia conti bancari che portafogli (es. Intesa San Paolo).

## 4. Strumenti Finanziari

Cluster supportati: ETF, BTP/Obbligazioni, Azioni, Criptovalute, Altro.

### 4.1 Commissioni e Tasse (3 livelli)

| Livello | Esempio |
|---|---|
| **Paese** | Plusvalenze 26%, cripto 26%, BTP 12.5% |
| **Istituzione** | Fee annua broker, commissione compravendita |
| **Strumento** | TER dal KID, commissioni specifiche del prospetto |

### 4.2 Import KID via LLM

L'utente carica il PDF del KID (Key Information Document, standard PRIIP). Claude API estrae: commissioni, tassazione, profilo di rischio, benchmark. Risultato revisionabile prima del salvataggio.

## 5. Import Dati

### 5.1 Conti Bancari — CSV

- Parser dedicati per ogni banca (Revolut, Intesa San Paolo, ecc.)
- **Deduplicazione:** transazione univoca per `(date, amount, counterparty)` — CSV sovrapposti non creano duplicati
- Feature futura: Open Banking API (Nordigen, tier gratuito)

### 5.2 Investimenti — Manuale + KID

- Inserimento manuale con double-check di indici, tassazioni, commissioni
- Import KID PDF via LLM per auto-compilazione dettagli strumento
- Feature futura: CSV dai broker

## 6. Prezzi di Mercato

- **Mercati tradizionali:** Yahoo Finance o Google Finance API (ETF, azioni, BTP)
- **Criptovalute:** CoinMarketCap o CoinGecko API (gratuita)
- Aggiornamento automatico, prezzi real-time nella dashboard

## 7. Valute

- Multi-valuta nativa — EUR e USD prioritari, altre aggiungibili
- Dashboard mostra: valore in valuta originale + equivalente EUR
- Tasso di cambio via API gratuita (es. exchangerate.host)

## 8. Categorizzazione Transazioni

- Regole keyword configurabili: "NETFLIX" → Abbonamenti
- Seed predefinito di provider noti (Netflix, Spotify, Amazon, YouTube...)
- Lista espandibile dagli utenti
- LLM opzionale per edge cases ambigui

## 9. Dashboard

1. **Net worth totale** — prominente in alto
2. **Breakdown per istituzione** — quanto su ogni banca/broker
3. **Performance investimenti** — rendimento % per strumento
4. **Ultime transazioni** — feed spese recenti

## 10. Piattaforma

- Web app self-hosted su Proxmox HomeLab
- Responsive — desktop-first, mobile per consultazione rapida
- Accessibile via VPN

## 11. Fuori Scope (v1)

- Notifiche push/email (feature futura: reminder settimanale via Resend)
- Open Banking API sync automatico
- CSV broker per investimenti
- Conti condivisi tra utenti
- App mobile nativa
- Registrazione pubblica
```

- [ ] **Step 5: Esegui i test per verificare che passino**

```bash
npm test -- --testPathPattern=spec.test.ts
```

Atteso: `3 passed`

- [ ] **Step 6: Commit**

```bash
git add src/lib/spec.ts SPEC.md src/__tests__/lib/spec.test.ts
git commit -m "feat: add spec parser and initial SPEC.md content"
```

---

## Task 4: API Routes — GET e POST messaggi

**Files:**
- Crea: `src/app/api/messages/route.ts`
- Crea: `src/__tests__/api/messages.test.ts`

- [ ] **Step 1: Scrivi il test fallente**

```typescript
// src/__tests__/api/messages.test.ts
import { GET, POST } from '@/app/api/messages/route'
import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

beforeEach(() => {
  db.exec('DELETE FROM messages')
})

function makeRequest(method: string, body?: object, params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/messages')
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'content-type': 'application/json' } : undefined,
  })
}

test('GET restituisce array vuoto inizialmente', async () => {
  const res = await GET(makeRequest('GET'))
  expect(res.status).toBe(200)
  const data = await res.json()
  expect(data).toEqual([])
})

test('POST crea un messaggio e lo restituisce', async () => {
  const res = await POST(makeRequest('POST', { author: 'Mario', content: 'Test proposta' }))
  expect(res.status).toBe(201)
  const data = await res.json()
  expect(data.author).toBe('Mario')
  expect(data.content).toBe('Test proposta')
})

test('POST rifiuta author mancante', async () => {
  const res = await POST(makeRequest('POST', { content: 'Testo' }))
  expect(res.status).toBe(400)
})

test('POST rifiuta content mancante', async () => {
  const res = await POST(makeRequest('POST', { author: 'Mario' }))
  expect(res.status).toBe(400)
})

test('GET con since filtra messaggi precedenti', async () => {
  await POST(makeRequest('POST', { author: 'Mario', content: 'Primo' }))
  const allRes = await GET(makeRequest('GET'))
  const all = await allRes.json()
  const since = all[0].created_at

  await POST(makeRequest('POST', { author: 'Nicol', content: 'Secondo' }))
  const filtered = await GET(makeRequest('GET', undefined, { since: String(since) }))
  const data = await filtered.json()
  expect(data).toHaveLength(1)
  expect(data[0].content).toBe('Secondo')
})
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

```bash
npm test -- --testPathPattern=api/messages.test.ts
```

Atteso: `Cannot find module '@/app/api/messages/route'`

- [ ] **Step 3: Crea `src/app/api/messages/route.ts`**

```typescript
// src/app/api/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getMessages, insertMessage } from '@/lib/messages'

export function GET(request: NextRequest): NextResponse {
  const sinceParam = request.nextUrl.searchParams.get('since')

  if (sinceParam !== null) {
    const since = parseInt(sinceParam, 10)
    if (isNaN(since)) {
      return NextResponse.json({ error: 'Parametro since non valido' }, { status: 400 })
    }
    return NextResponse.json(getMessages(since))
  }

  return NextResponse.json(getMessages())
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }

  const { author, content } = body as Record<string, unknown>

  if (!author || typeof author !== 'string' || author.trim().length === 0) {
    return NextResponse.json({ error: 'Author obbligatorio' }, { status: 400 })
  }
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return NextResponse.json({ error: 'Content obbligatorio' }, { status: 400 })
  }
  if (author.length > 50) {
    return NextResponse.json({ error: 'Author troppo lungo (max 50)' }, { status: 400 })
  }
  if (content.length > 1000) {
    return NextResponse.json({ error: 'Content troppo lungo (max 1000)' }, { status: 400 })
  }

  const message = insertMessage(author.trim(), content.trim())
  return NextResponse.json(message, { status: 201 })
}
```

- [ ] **Step 4: Esegui i test per verificare che passino**

```bash
npm test -- --testPathPattern=api/messages.test.ts
```

Atteso: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/messages/route.ts src/__tests__/api/messages.test.ts
git commit -m "feat: add GET/POST API routes for messages"
```

---

## Task 5: Componenti server — `SpecViewer` e `SpecSidebar`

**Files:**
- Crea: `src/components/SpecViewer.tsx`
- Crea: `src/components/SpecSidebar.tsx`

- [ ] **Step 1: Crea `src/components/SpecViewer.tsx`**

```typescript
// src/components/SpecViewer.tsx
import { readSpec } from '@/lib/spec'

export default function SpecViewer() {
  const { html } = readSpec()

  return (
    <article
      className="prose prose-invert prose-zinc max-w-none
        prose-headings:text-zinc-100 prose-headings:font-semibold
        prose-p:text-zinc-300 prose-li:text-zinc-300
        prose-code:text-emerald-400 prose-code:bg-zinc-800 prose-code:px-1 prose-code:rounded
        prose-pre:bg-zinc-800 prose-pre:border prose-pre:border-zinc-700
        prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline
        prose-blockquote:border-l-emerald-500 prose-blockquote:text-zinc-400
        prose-table:text-zinc-300 prose-th:text-zinc-100
        prose-hr:border-zinc-700"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
```

- [ ] **Step 2: Installa `@tailwindcss/typography`**

```bash
npm install @tailwindcss/typography
```

Nel file `tailwind.config.ts` aggiungi il plugin:

```typescript
import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  plugins: [typography],
}

export default config
```

- [ ] **Step 3: Crea `src/components/SpecSidebar.tsx`**

```typescript
// src/components/SpecSidebar.tsx
'use client'

import { useEffect, useState } from 'react'
import type { Heading } from '@/lib/spec'

interface Props {
  headings: Heading[]
}

export default function SpecSidebar({ headings }: Props) {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    )

    headings.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [headings])

  const filtered = headings.filter((h) => h.level <= 3)

  return (
    <nav className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
        Indice
      </p>
      <ul className="space-y-1">
        {filtered.map((h) => (
          <li key={h.id} style={{ paddingLeft: `${(h.level - 1) * 12}px` }}>
            <a
              href={`#${h.id}`}
              className={`block text-sm py-0.5 transition-colors ${
                activeId === h.id
                  ? 'text-emerald-400 font-medium'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/SpecViewer.tsx src/components/SpecSidebar.tsx tailwind.config.ts
git commit -m "feat: add SpecViewer and SpecSidebar components"
```

---

## Task 6: Componenti chat — `ChatBubble`, `ChatFeed`, `ChatForm`

**Files:**
- Crea: `src/components/ChatBubble.tsx`
- Crea: `src/components/ChatFeed.tsx`
- Crea: `src/components/ChatForm.tsx`

- [ ] **Step 1: Crea `src/components/ChatBubble.tsx`**

```typescript
// src/components/ChatBubble.tsx
import type { Message } from '@/lib/messages'

interface Props {
  message: Message
  isOwn: boolean
}

function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ChatBubble({ message, isOwn }: Props) {
  return (
    <div className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-2 text-xs text-zinc-500 ${isOwn ? 'flex-row-reverse' : ''}`}>
        <span className="font-medium text-zinc-400">{message.author}</span>
        <span>{formatTime(message.created_at)}</span>
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
          isOwn
            ? 'bg-emerald-700 text-white rounded-tr-sm'
            : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Crea `src/components/ChatFeed.tsx`**

```typescript
// src/components/ChatFeed.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import ChatBubble from './ChatBubble'
import type { Message } from '@/lib/messages'

interface Props {
  initialMessages: Message[]
  ownAuthor: string | null
}

export default function ChatFeed({ initialMessages, ownAuthor }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const poll = async () => {
      const last = messages[messages.length - 1]
      const since = last ? last.created_at : 0
      try {
        const res = await fetch(`/api/messages?since=${since}`)
        if (!res.ok) return
        const newMsgs: Message[] = await res.json()
        if (newMsgs.length > 0) {
          setMessages((prev) => [...prev, ...newMsgs])
        }
      } catch {
        // silent fail — riprova al prossimo tick
      }
    }

    const interval = setInterval(poll, 10_000)
    return () => clearInterval(interval)
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-zinc-600 text-sm">
        Nessun messaggio ancora. Sii il primo a proporre qualcosa!
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
      {messages.map((msg) => (
        <ChatBubble
          key={msg.id}
          message={msg}
          isOwn={ownAuthor !== null && msg.author === ownAuthor}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 3: Crea `src/components/ChatForm.tsx`**

```typescript
// src/components/ChatForm.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import type { Message } from '@/lib/messages'

interface Props {
  onSent: (message: Message) => void
}

const AUTHOR_KEY = 'ww_author'

export default function ChatForm({ onSent }: Props) {
  const [author, setAuthor] = useState('')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const contentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem(AUTHOR_KEY)
    if (saved) setAuthor(saved)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmedAuthor = author.trim()
    const trimmedContent = content.trim()

    if (!trimmedAuthor) { setError('Inserisci il tuo nome'); return }
    if (!trimmedContent) { setError('Scrivi un messaggio'); return }

    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ author: trimmedAuthor, content: trimmedContent }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Errore nell\'invio')
        return
      }

      const message: Message = await res.json()
      localStorage.setItem(AUTHOR_KEY, trimmedAuthor)
      setContent('')
      onSent(message)
      contentRef.current?.focus()
    } catch {
      setError('Errore di rete. Riprova.')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-zinc-800 px-4 py-3 flex flex-col gap-2">
      {error && (
        <p className="text-red-400 text-xs">{error}</p>
      )}
      <div className="flex gap-2 items-end">
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Il tuo nome"
          maxLength={50}
          className="w-28 shrink-0 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors"
        />
        <textarea
          ref={contentRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Proponi una modifica o nuova feature… (Invio per inviare)"
          maxLength={1000}
          rows={1}
          className="flex-1 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 transition-colors resize-none"
        />
        <button
          type="submit"
          disabled={sending}
          className="shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          {sending ? '…' : 'Invia'}
        </button>
      </div>
      <p className="text-xs text-zinc-600 text-right">{content.length}/1000</p>
    </form>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ChatBubble.tsx src/components/ChatFeed.tsx src/components/ChatForm.tsx
git commit -m "feat: add chat components (ChatBubble, ChatFeed, ChatForm)"
```

---

## Task 7: Layout e pagina principale

**Files:**
- Modifica: `src/app/globals.css`
- Modifica: `src/app/layout.tsx`
- Crea: `src/app/page.tsx`

- [ ] **Step 1: Aggiorna `src/app/globals.css`**

Sostituisci tutto il contenuto con:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

:root {
  color-scheme: dark;
}

html {
  background-color: #09090b;
  color: #fafafa;
}

* {
  scroll-behavior: smooth;
}

::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: #18181b;
}
::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #52525b;
}
```

- [ ] **Step 2: Aggiorna `src/app/layout.tsx`**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'WealthWatcher — Spec',
  description: 'Specifiche del progetto WealthWatcher',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className="dark">
      <body className={`${geist.variable} ${geistMono.variable} font-sans antialiased bg-zinc-950 text-zinc-100 min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Crea `src/app/page.tsx`**

Nota: il componente `ChatSection` è un client wrapper che tiene i messaggi in stato e connette `ChatFeed` e `ChatForm`.

```typescript
// src/app/page.tsx
import { getMessages } from '@/lib/messages'
import { readSpec } from '@/lib/spec'
import SpecViewer from '@/components/SpecViewer'
import SpecSidebar from '@/components/SpecSidebar'
import ChatSection from '@/components/ChatSection'

export const dynamic = 'force-dynamic'

export default function Home() {
  const messages = getMessages()
  const { headings } = readSpec()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center text-sm font-bold text-zinc-950">
            W
          </div>
          <span className="font-semibold text-zinc-100">WealthWatcher</span>
          <span className="text-zinc-600 text-sm">— Specifiche v0.1</span>
        </div>
      </header>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 flex flex-col lg:flex-row gap-8">
        {/* Spec + Sidebar */}
        <div className="flex-1 flex gap-8 min-w-0">
          <main className="flex-1 min-w-0">
            <SpecViewer />
          </main>
          <aside className="hidden xl:block w-56 shrink-0">
            <SpecSidebar headings={headings} />
          </aside>
        </div>

        {/* Chat panel */}
        <div className="lg:w-96 shrink-0">
          <div className="sticky top-20 flex flex-col h-[calc(100vh-6rem)] rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium text-zinc-200">Discussione & Proposte</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ChatSection initialMessages={messages} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Crea `src/components/ChatSection.tsx`** — client wrapper che connette feed e form

```typescript
// src/components/ChatSection.tsx
'use client'

import { useState, useEffect } from 'react'
import ChatFeed from './ChatFeed'
import ChatForm from './ChatForm'
import type { Message } from '@/lib/messages'

const AUTHOR_KEY = 'ww_author'

interface Props {
  initialMessages: Message[]
}

export default function ChatSection({ initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [ownAuthor, setOwnAuthor] = useState<string | null>(null)

  useEffect(() => {
    setOwnAuthor(localStorage.getItem(AUTHOR_KEY))
  }, [])

  function handleSent(message: Message) {
    setMessages((prev) => [...prev, message])
    setOwnAuthor(message.author)
    localStorage.setItem(AUTHOR_KEY, message.author)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <ChatFeed messages={messages} ownAuthor={ownAuthor} />
      </div>
      <ChatForm onSent={handleSent} />
    </div>
  )
}
```

**Nota:** aggiorna `ChatFeed` per accettare `messages` come prop invece di stato interno (ora lo stato è in `ChatSection`). Modifica la firma:

```typescript
// src/components/ChatFeed.tsx — aggiorna Props e rimuovi useState iniziale
interface Props {
  messages: Message[]
  ownAuthor: string | null
}

export default function ChatFeed({ messages, ownAuthor }: Props) {
  // Rimuovi: const [messages, setMessages] = useState<Message[]>(initialMessages)
  // Il polling aggiunge messaggi tramite onNewMessages callback — vedi nota sotto
  ...
}
```

**Gestione polling dopo refactor:** poiché lo stato è in `ChatSection`, passa un callback `onNewMessages` a `ChatFeed`:

```typescript
// src/components/ChatFeed.tsx — versione finale
'use client'

import { useEffect, useRef } from 'react'
import ChatBubble from './ChatBubble'
import type { Message } from '@/lib/messages'

interface Props {
  messages: Message[]
  ownAuthor: string | null
  onNewMessages: (msgs: Message[]) => void
}

export default function ChatFeed({ messages, ownAuthor, onNewMessages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const poll = async () => {
      const last = messages[messages.length - 1]
      const since = last ? last.created_at : 0
      try {
        const res = await fetch(`/api/messages?since=${since}`)
        if (!res.ok) return
        const newMsgs: Message[] = await res.json()
        if (newMsgs.length > 0) onNewMessages(newMsgs)
      } catch { /* silent */ }
    }
    const interval = setInterval(poll, 10_000)
    return () => clearInterval(interval)
  }, [messages, onNewMessages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-zinc-600 text-sm">
        Nessun messaggio ancora. Sii il primo a proporre qualcosa!
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {messages.map((msg) => (
        <ChatBubble
          key={msg.id}
          message={msg}
          isOwn={ownAuthor !== null && msg.author === ownAuthor}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
```

Aggiorna `ChatSection` per passare `onNewMessages`:

```typescript
// in ChatSection.tsx — aggiorna il render di ChatFeed
<ChatFeed
  messages={messages}
  ownAuthor={ownAuthor}
  onNewMessages={(newMsgs) => setMessages((prev) => [...prev, ...newMsgs])}
/>
```

- [ ] **Step 5: Verifica che la build compili senza errori**

```bash
npm run build
```

Atteso: build completata senza errori TypeScript.

- [ ] **Step 6: Avvia in dev mode e verifica manualmente**

```bash
npm run dev
```

Apri `http://localhost:3000`. Verifica:
- Spec renderizzata con tipografia corretta
- Sidebar con TOC (su schermi larghi)
- Chat panel a destra
- Invio messaggio funzionante
- La bolla appare con nome corretto
- Messaggio successivo con altro nome appare a sinistra

- [ ] **Step 7: Commit**

```bash
git add src/app/ src/components/ChatSection.tsx
git commit -m "feat: assemble main page with spec viewer and chat panel"
```

---

## Task 8: Docker e deploy

**Files:**
- Crea: `Dockerfile`
- Crea: `docker-compose.yml`
- Crea: `.dockerignore`

- [ ] **Step 1: Crea `.dockerignore`**

```
node_modules
.next
.git
data/*.db
*.md
!SPEC.md
.env*
```

- [ ] **Step 2: Crea `Dockerfile`**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/chat.db

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/SPEC.md ./SPEC.md

VOLUME /data
EXPOSE 3000

USER nextjs
CMD ["node", "server.js"]
```

- [ ] **Step 3: Abilita `output: standalone` in `next.config.ts`**

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Step 4: Crea `docker-compose.yml`**

```yaml
services:
  wealthwatcher-spec:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
      - ./SPEC.md:/app/SPEC.md:ro
    restart: unless-stopped
    environment:
      - DATABASE_PATH=/data/chat.db
```

Il volume `./SPEC.md:/app/SPEC.md:ro` permette di aggiornare la spec senza rebuild — basta `git pull` e ricaricare la pagina.

- [ ] **Step 5: Testa la build Docker**

```bash
docker compose build
```

Atteso: build completata senza errori.

- [ ] **Step 6: Avvia e testa il container**

```bash
docker compose up -d
```

Apri `http://localhost:3000`. Verifica:
- Spec caricata correttamente
- Chat funzionante
- Messaggio salvato persiste dopo `docker compose restart`

```bash
docker compose restart
```

Apri `http://localhost:3000` — i messaggi della chat devono essere ancora presenti.

- [ ] **Step 7: Commit finale**

```bash
git add Dockerfile docker-compose.yml .dockerignore next.config.ts
git commit -m "feat: add Docker setup with standalone Next.js build"
```

---

## Deploy su Proxmox

Sul server Proxmox (dentro la VM/LXC):

```bash
git clone <repo-url> wealthwatcher
cd wealthwatcher
docker compose up -d
```

**Aggiornare la spec:**
```bash
git pull
# SPEC.md aggiornato — nessun rebuild necessario, il volume è montato live
```

**Aggiornare il codice:**
```bash
git pull
docker compose up -d --build
```

---

## Self-Review

**Copertura spec:**
- [x] Next.js 15 + TypeScript + Tailwind
- [x] SQLite via better-sqlite3
- [x] SPEC.md renderizzato con sidebar TOC
- [x] Chat bubble UI dark mode
- [x] Polling ogni 10s
- [x] Nome autore persistito in localStorage (own vs others)
- [x] Validazione lato server (author max 50, content max 1000)
- [x] Docker con volume per SQLite e SPEC.md montato live
- [x] deploy su Proxmox documentato
- [x] TDD per DB layer e API routes

**Placeholder:** nessuno.

**Consistenza tipi:** `Message` definita in `messages.ts`, importata in tutti i componenti. `Heading` definita in `spec.ts`, passata a `SpecSidebar`. `onNewMessages` callback consistente tra `ChatSection` e `ChatFeed`.
