# WealthWatcher — Specifiche

> Documento vivente. Proponi modifiche tramite la chat qui sotto.

## 1. Vision

WealthWatcher è un gestore patrimoniale personale self-hosted che aggrega conti bancari e portafogli di investimento in un'unica interfaccia web, mostrando net worth, andamento nel tempo e analisi delle spese.

**Principio guida:** ogni numero mostrato deve essere *tracciabile* e *ricostruibile* dai dati grezzi. Niente cifre "magiche" non spiegabili.

## 2. Utenti e Controllo Accessi

- Target: friends & family (gruppo chiuso, ~10 persone max)
- Autenticazione: Auth.js con Google OAuth
- **Allowlist obbligatoria:** OAuth autentica, *non* autorizza. Solo le email presenti in una allowlist (tabella `allowed_emails` / inviti) possono accedere. Nessuna registrazione aperta.
- **Ruoli:** `admin` (gestisce allowlist e istituzioni/parser) e `member`.

### 2.1 Modello di Ownership (deciso da subito)

Anche se i conti condivisi sono v2, il modello dati li prevede *ora* per evitare refactor:

- Ogni entità con dati personali ha un `owner_id`.
- Tabella `shares (entity_type, entity_id, user_id, role)` per la condivisione futura (es. conto di coppia).
- Tutte le query passano da un filtro di accesso centralizzato: un utente vede un'entità se ne è owner **o** se compare in `shares`.

## 3. Modello Dati

```
User
 └── owns / shares ──────────────┐
                                 ▼
Institution (banca/broker)
├── BankAccount (0+)             ← conto corrente, risparmio
│   └── Transaction (n)          ← movimenti bancari (entrate/uscite)
└── InvestmentPortfolio (0+)     ← conto trading
    └── Position (n)             ← posizione su un Instrument
        ├── Lot (n)              ← acquisti a prezzo di carico
        └── InvestmentTxn (n)    ← buy / sell / dividend / fee
Instrument (anagrafica strumento, condivisa tra utenti)
PriceHistory  (instrument_id, date, price, currency)
FxHistory     (base, quote, date, rate)
ValuationSnapshot (owner_id, date, total_value_eur, breakdown_json)
```

Un'istituzione può avere sia conti bancari che portafogli (es. Intesa San Paolo).

### 3.1 Perché `Position` + `Lot` + `InvestmentTxn` (non una semplice "Holding")

Una quantità corrente non basta: per calcolare **performance** e **plusvalenze** servono prezzo di carico e storia delle operazioni.

- **`Instrument`** — anagrafica condivisa (ISIN/ticker, cluster, valuta, TER, fonte prezzo). Riusabile tra utenti.
- **`InvestmentTxn`** — ogni operazione: `buy`, `sell`, `dividend`, `fee`, `split`. Con quantità, prezzo, commissione, valuta, data.
- **`Lot`** — tranche d'acquisto residue, per il calcolo del prezzo medio/di carico e delle plusvalenze a realizzo (**default FIFO**, configurabile).
- **`Position`** — vista aggregata derivata (quantità, costo medio, valore corrente, P/L). È *calcolata*, non fonte di verità.

## 4. Strumenti Finanziari

Cluster supportati: ETF, BTP/Obbligazioni, Azioni, Criptovalute, Altro.

### 4.1 Commissioni e Tassazione (3 livelli)

| Livello | Esempio |
|---|---|
| **Paese** | Plusvalenze 26%, cripto 26%, titoli di Stato white-list 12.5% |
| **Istituzione** | Fee annua broker, commissione compravendita |
| **Strumento** | TER dal KID, commissioni specifiche del prospetto |

> ⚠️ **Disclaimer fiscale (v1).** Le imposte mostrate sono **stime informative, non consulenza fiscale**. Il motore v1 applica aliquote semplici sul realizzato; **non** gestisce zoccolo dei minus compensabili, regime amministrato vs dichiarativo, imposta di bollo, affrancamenti. Un *tax engine* serio è una fase a sé (vedi §13). Ogni stima è etichettata come tale in UI.

### 4.2 Import KID via LLM

L'utente carica il PDF del KID (Key Information Document, standard PRIIP). Claude API estrae commissioni, tassazione, profilo di rischio, benchmark.

- **Output strutturato** secondo uno schema JSON fisso (no testo libero).
- **Confidenza per campo** + evidenziazione dei valori incerti.
- **Revisione umana obbligatoria** prima del salvataggio: nessun numero fiscale/commissionale entra nel DB senza conferma.
- Chiave Claude API gestita come segreto d'ambiente (vedi §11). Costo per estrazione tracciato.

## 5. Import Dati

### 5.1 Conti Bancari — CSV

- Parser dedicati per banca (Revolut, Intesa San Paolo, ecc.), con attenzione a: encoding (latin-1/UTF-8), **decimali con la virgola**, date `gg/mm/aaaa`, multi-valuta (Revolut).
- **Preview prima dell'import:** l'utente vede righe parse-ate, mapping colonne ed errori *prima* di confermare.
- **Deduplicazione robusta** (la chiave naturale `(date, amount, counterparty)` NON basta — due caffè uguali stesso giorno sono duplicati legittimi):
  1. Se la banca fornisce un **id transazione esterno** → chiave primaria di dedup.
  2. Altrimenti **hash di riga** (tutti i campi grezzi) + **import batch** per ricostruire la provenienza.
  3. Possibili duplicati "sospetti" segnalati all'utente, non silenziosamente collassati.
- Feature futura: Open Banking API (Nordigen/GoCardless, tier gratuito).

### 5.2 Investimenti — Manuale + KID

- Inserimento manuale delle operazioni (`InvestmentTxn`), con double-check di strumento, tassazione, commissioni.
- Import KID PDF via LLM per auto-compilazione dettagli `Instrument`.
- Feature futura: CSV dai broker.

## 6. Prezzi di Mercato e Storicizzazione

### 6.1 Fonti

- **Mercati tradizionali (ETF, azioni, BTP):** Yahoo Finance non offre API ufficiale gratuita (scraping fragile, rischio ToS). Si adotta un provider con piano gratuito documentato (es. **Twelve Data** / **Alpha Vantage**) + fallback. I BTP hanno copertura scarsa → ammesso inserimento prezzo manuale.
- **Criptovalute:** CoinGecko (free tier).
- Ogni fonte ha: **caching**, **rate-limit**, **fallback** e comportamento esplicito **se la fonte è down** (mostra ultimo prezzo noto + timestamp "stale").

### 6.2 Storicizzazione (prerequisito dei grafici)

- `PriceHistory` e `FxHistory` memorizzano serie temporali (non solo l'ultimo valore).
- **`ValuationSnapshot`**: job giornaliero che salva il valore totale e il breakdown per ogni owner → alimenta i grafici di andamento del net worth e dei portafogli.

## 7. Valute

- Multi-valuta nativa — EUR e USD prioritari, altre aggiungibili.
- Dashboard mostra: valore in valuta originale + equivalente EUR.
- **Cambi storici** memorizzati in `FxHistory`: i grafici storici usano il tasso *del giorno*, non quello corrente. Fonte: API gratuita (es. exchangerate.host / Frankfurter).

## 8. Categorizzazione Transazioni

### 8.1 Normalizzazione Counterparty/Merchant (prerequisito)

Il `counterparty` grezzo è sporco (lo stesso merchant compare con stringhe diverse). Prima di categorizzare o aggregare:

- Pulizia/normalizzazione della stringa (rimozione id transazione, città, suffissi POS).
- Mappatura a un **merchant canonico** (tabella di alias espandibile).
- Senza questo passaggio, categorizzazione e report mensili danno risultati scadenti.

### 8.2 Regole

- Regole keyword configurabili: "NETFLIX" → Abbonamenti.
- Seed predefinito di provider noti (Netflix, Spotify, Amazon, YouTube...).
- Lista espandibile dagli utenti.
- LLM opzionale per edge case ambigui.

### 8.3 Destinatari Ricorrenti e Report Mensile

- **Definizione di "ricorrente":** ≥ N occorrenze dello stesso merchant canonico in mesi distinti, con importo entro una tolleranza configurabile (per cogliere abbonamenti a importo variabile).
- Accumulo delle spese per merchant nel tempo.
- Report mensile delle uscite con breakdown per merchant e per categoria.

## 9. Dashboard

1. **Net worth totale** — prominente in alto
2. **Breakdown per istituzione** — quanto su ogni banca/broker
3. **Performance investimenti** — rendimento % per posizione (da `Lot`/`InvestmentTxn`)
4. **Ultime transazioni** — feed spese recenti
5. **Grafici andamento** — trend storico di net worth e portafogli (da `ValuationSnapshot`)

## 10. Piattaforma e Architettura

- Web app self-hosted su Proxmox HomeLab, Next.js + SQLite.
- Responsive — desktop-first, mobile per consultazione rapida.
- Accessibile via VPN.
- **SQLite in modalità WAL** per reggere letture concorrenti + scritture dei job.
- **Job schedulati** (prezzi, cambi, snapshot, report, futuro Telegram): runner dedicato (cron esterno o `node-cron` in-process da decidere) — non improvvisati dentro le route HTTP.

## 11. Non-Funzionali: Sicurezza, Segreti, Backup

- **Segreti** (Google OAuth, Claude API, provider prezzi) solo via variabili d'ambiente; mai nel repo.
- **Dati sensibili:** sono i dati finanziari di 10 persone. Accesso solo via VPN, ownership filtrata lato server su ogni query.
- **Backup & Disaster Recovery:** backup automatico periodico del file SQLite (con WAL checkpoint), conservato off-host; procedura di restore documentata e testata. Questo è **bloccante per la v1** — non un nice-to-have.
- **GDPR minimo:** export/cancellazione dei propri dati su richiesta.

## 12. Roadmap e Definizione di "Fatto"

> La v1 NON è "tutto lo SPEC". È il sottoinsieme che dà valore reale prima possibile.

| Milestone | Contenuto | "Fatto" quando |
|---|---|---|
| **M0 — Fondamenta** | Auth.js + allowlist, schema DB con ownership, backup | Un utente in allowlist accede e vede solo i propri dati; restore testato |
| **M1 — Conti & Spese** | Import CSV (1 banca) con dedup robusta + preview, normalizzazione merchant, categorizzazione, report mensile | Importo un CSV due volte senza duplicati; vedo report uscite per merchant |
| **M2 — Investimenti** | `Instrument`/`Position`/`Lot`/`InvestmentTxn` manuali, prezzi correnti, performance % | Inserisco operazioni e vedo P/L corretto per posizione |
| **M3 — Storico & Dashboard** | `PriceHistory`/`FxHistory`/`ValuationSnapshot` + job giornaliero, grafici andamento | Il net worth ha un grafico storico coerente coi cambi del giorno |
| **M4 — KID & Tax stima** | Import KID via LLM (output strutturato + review), stima fiscale con disclaimer | Carico un KID e confermo i dati estratti; stima imposte etichettata |

## 13. Fuori Scope (v1)

- **Tax engine completo** (zoccolo minus, bollo, regimi, affrancamento) — fase dedicata post-v1
- Notifiche push/email (feature futura: reminder settimanale via Resend)
- Bot Telegram per annunci/notifiche su investimenti (feature futura; richiede linking utente Telegram↔app e trigger definiti)
- Open Banking API sync automatico
- CSV broker per investimenti
- Conti condivisi tra utenti (modello dati già predisposto, UI no)
- App mobile nativa
- Registrazione pubblica
