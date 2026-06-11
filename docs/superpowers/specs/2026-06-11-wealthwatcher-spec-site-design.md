# WealthWatcher — Spec-Sharing Site Design

**Data:** 2026-06-11  
**Scope:** Sito Next.js per condividere le specifiche di WealthWatcher e raccogliere proposte via chat, da deployare su Proxmox HomeLab via Docker.

---

## 1. Contesto e Obiettivo

Prima di implementare WealthWatcher (gestore patrimoniale personale), serve un sito temporaneo per:

1. Mostrare il documento delle specifiche (`SPEC.md`) a Nicol e al suo amico
2. Permettere a chiunque abbia il link di proporre modifiche e nuove feature tramite una chat
3. Raccogliere tutti i requisiti prima di passare a implementazione e progettazione del database

Il sito gira sulla rete locale di Nicol (HomeLab Proxmox), accessibile solo via VPN — la VPN funge da layer di sicurezza, nessuna autenticazione applicativa necessaria.

---

## 2. Stack Tecnologico

| Componente | Scelta | Motivazione |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR nativo, Server Actions, deploy semplice |
| Database | SQLite via `better-sqlite3` | Zero dipendenze esterne, embedded nel container |
| Rendering spec | `gray-matter` + `remark` | Parsing Markdown → HTML |
| Auth | Nessuna | VPN è il gatekeeper |
| Deploy | Docker Compose | Deploy semplice su Proxmox |
| Stile | Tailwind CSS, dark mode | UI moderna, bubble chat |

---

## 3. Architettura

```
SPEC.md (repo) ──→ Next.js SSR ──→ Pagina renderizzata
                                          │
                                   Chat (polling 10s)
                                          │
                              Server Action → SQLite → messaggio salvato
```

**File system:**
```
/
├── SPEC.md                  ← documento spec, editato via git/Claude Code
├── docs/
│   └── superpowers/specs/   ← design docs
├── /data/
│   └── chat.db              ← SQLite, volume Docker persistente
```

---

## 4. Pagine e UI

### Unica pagina `/`

Layout verticale in due sezioni:

**Sezione 1 — Spec:**
- Documento `SPEC.md` renderizzato come HTML con tipografia pulita
- Sidebar sticky con indice delle sezioni (heading H2/H3)
- Font moderno (Geist o Inter)

**Sezione 2 — Chat:**
- Header "Discussione & Proposte"
- Lista messaggi in stile bubble chat (Discord/Slack/iMessage)
- Bolle allineate a destra per un autore, sinistra per gli altri
- Ogni bolla mostra: nome autore, contenuto, timestamp
- Dark mode, colori accent coordinati con brand WealthWatcher
- Form fisso in basso: campo `Nome` + campo `Messaggio` + bottone Invia
- Polling ogni 10 secondi per nuovi messaggi (no WebSocket)

### Componenti
- `SpecViewer` — renderizza SPEC.md come HTML
- `ChatFeed` — lista messaggi con auto-scroll, polling incrementale
- `ChatForm` — Server Action per submit, validazione lato server (nome e contenuto non vuoti, max 1000 char)

---

## 5. Modello Dati

```sql
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  author     TEXT    NOT NULL CHECK(length(author) <= 50),
  content    TEXT    NOT NULL CHECK(length(content) <= 1000),
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

### API

| Endpoint | Metodo | Descrizione |
|---|---|---|
| `/api/messages?since=<unix>` | GET | Messaggi più recenti del timestamp dato |
| `/api/messages` | POST | Invia nuovo messaggio `{ author, content }` |

Il polling usa `since` per caricare solo nuovi messaggi, non ricaricare tutta la lista.

---

## 6. Docker

### Dockerfile

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
VOLUME /data
ENV DATABASE_PATH=/data/chat.db
EXPOSE 3000
CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
services:
  wealthwatcher-spec:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./data:/data
    restart: unless-stopped
```

### Deploy su Proxmox

```bash
git clone <repo> wealthwatcher
cd wealthwatcher
docker compose up -d
```

**Aggiornare la spec:**
1. Modifica `SPEC.md` nel repo (direttamente o via Claude Code)
2. `git pull` sul server
3. `docker compose restart` (oppure `docker compose up -d --build` se cambia codice)

---

## 7. WealthWatcher — Specifiche Raccolte

Questa sezione documenta tutte le feature e decisioni raccolte durante il brainstorming, da usare come base per il `SPEC.md` che verrà mostrato nel sito.

### 7.1 Utenti e Accesso

- App per **friends & family** (piccolo gruppo di utenti noti)
- **Autenticazione:** Auth.js (NextAuth) con Google OAuth — gratuito, self-hosted, nessuna dipendenza cloud
- **Dati isolati per utente** — ogni persona vede solo i propri conti e portafogli
- Feature futura: conti condivisi (es. spese di coppia)

### 7.2 Struttura Entità

```
Institution (banca/broker)
├── BankAccount (0+)      ← conto corrente, conto risparmio
│   └── Transaction (n)
└── InvestmentPortfolio (0+)  ← conto trading
    └── Holding (n)           ← singolo strumento finanziario
```

Un'istituzione può avere contemporaneamente conti bancari e portafogli investimento (es. Intesa San Paolo con conto corrente + dossier titoli).

### 7.3 Strumenti Finanziari

Ogni strumento appartiene a un cluster/tipo:
- ETF
- BTP / Obbligazioni
- Azioni
- Criptovalute
- Altro

**Commissioni e tasse — 3 livelli sovrapposti:**

| Livello | Esempio |
|---|---|
| **Paese** | Plusvalenze 26%, cripto 26%, BTP 12.5% |
| **Istituzione** | Fee annua broker, commissione compravendita |
| **Strumento** | TER (Total Expense Ratio) da KID, commissioni specifiche |

**Import KID via LLM:** l'utente carica il PDF del KID (Key Information Document, standardizzato PRIIP), un LLM (Claude API) estrae strutturato: commissioni, tassazione, profilo di rischio, benchmark. Risultato revisionabile dall'utente prima del salvataggio.

### 7.4 Import Dati Bancari

- **CSV per banche:** parser dedicati per ogni banca (Revolut, Intesa San Paolo, ecc.) — ogni formato studiato e implementato separatamente
- **Deduplicazione:** una transazione è univoca per `(date, amount, counterparty)` — se due CSV si sovrappongono, vengono salvate solo le transazioni mai viste prima
- **Open Banking API (futuro):** Nordigen/GoCardless, tier gratuito senza requisiti istituzionali

### 7.5 Import Investimenti

- **Inserimento manuale** con double-check di indici, tassazioni e commissioni
- **Import KID PDF** via LLM per popolare automaticamente i dettagli dello strumento
- **CSV broker (futuro):** quando i formati dei broker saranno studiati

### 7.6 Prezzi di Mercato

- **Mercati tradizionali:** Yahoo Finance API o Google Finance (ETF, azioni, BTP)
- **Criptovalute:** CoinMarketCap o CoinGecko API (gratuita)
- Aggiornamento automatico, prezzi mostrati in tempo reale nella dashboard

### 7.7 Valute

- **Multi-valuta nativa** — ogni conto mantiene la propria valuta (EUR, USD prioritari)
- Dashboard mostra sempre: valore in valuta originale + equivalente EUR
- Tasso di cambio via API gratuita (es. exchangerate.host)
- Altre valute aggiungibili in futuro

### 7.8 Categorizzazione Transazioni

- **Regole keyword configurabili:** "NETFLIX" → Abbonamenti, "SPOTIFY" → Abbonamenti, ecc.
- **Seed predefinito** di provider noti (Netflix, Spotify, Amazon, YouTube, ecc.)
- **Lista espandibile** dagli utenti
- LLM opzionale per edge cases ambigui

### 7.9 Dashboard

Schermata principale con:
1. **Net worth totale** (somma conti bancari + valore portafogli) — prominente in alto
2. **Breakdown per istituzione** — quanto su ogni banca/broker
3. **Performance investimenti** — rendimento % per strumento
4. **Ultime transazioni** — feed delle spese recenti

### 7.10 Notifiche

- Nessuna notifica nella versione iniziale
- **Feature futura:** email reminder settimanale/mensile per aggiornare estratti conto, via servizio email gratuito (Resend o Nodemailer)

### 7.11 Piattaforma

- **Web app** self-hosted su Proxmox HomeLab
- **Responsive** — desktop-first per dashboard complessa, mobile per consultazione rapida
- Accessibile via VPN

---

## 8. Fuori Scope (Versione Iniziale)

- Notifiche push/email
- Open Banking API sync automatico
- CSV broker per investimenti
- Conti condivisi tra utenti
- App mobile nativa
- Multi-tenant / registrazione pubblica
