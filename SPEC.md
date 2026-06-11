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
