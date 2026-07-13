# Sicurezza & Privacy — riferimento tecnico

Documento tecnico per chi sviluppa/gestisce l'istanza. Per il testo legale
rivolto agli utenti finali vedi `/privacy` (`src/app/privacy/page.tsx`).

## Autenticazione

- **Provider**: Google OAuth sempre attivo; login passwordless (`Credentials`)
  registrato **solo** se `AUTH_DEV_LOGIN=true` (`src/auth.ts`). Va lasciato
  disattivato su qualunque istanza raggiungibile da chi non è pienamente
  fidato — VPN inclusa, a maggior ragione se esposta su Internet — perché
  l'unico "segreto" di quel provider è conoscere un'email in allowlist,
  nessuna prova di possesso.
- **Allowlist**: `allowed_emails` (ruoli `admin`/`member`). `SEED_ADMIN_EMAIL`
  fa solo da bootstrap una tantum: non bypassa l'autenticazione, quell'email
  deve comunque autenticarsi via Google (o Credentials se attivo).
- **Sessione**: JWT, durata massima 7 giorni. Il callback `jwt` ri-verifica
  l'allowlist a ogni richiesta (non solo al login): un'email rimossa o
  declassata perde l'accesso/il ruolo aggiornato immediatamente, senza dover
  aspettare la scadenza del token.
- **Rate limiting** (`src/lib/rateLimit.ts`, in-memory, per singolo processo):
  tentativi di login passwordless, POST `/api/messages`, avvio/consenso e
  sync Open Banking.
- **Redirect post-login**: `callbackUrl` validato con `isSafeRedirectPath`
  (`src/lib/security/redirect.ts`) — rifiuta URL protocol-relative
  (`//evil.com`) e backslash iniziali, accetta solo path interni.
- **Fusione account per email**: `users.email` ha vincolo UNIQUE
  (`src/db/schema.ts`) e `upsertUser` (`src/lib/users.ts`) fa
  `INSERT ... ON CONFLICT(email) DO UPDATE` — un'email che accede prima via
  Credentials (whitelist) e poi via Google (o viceversa) risolve sempre alla
  **stessa riga** `users`, stesso `id`, stessi dati posseduti (`owner_id`).
  Nessuna tabella `accounts` di NextAuth: l'identità è puramente
  email-based, normalizzata con `normalizeEmail` (trim + lowercase).
  Verificato in `src/__tests__/lib/users.test.ts`.
- **`email_verified` (Google)**: il callback `signIn` rifiuta il login
  Google se `profile.email_verified === false` — la fusione per email si
  fida di quell'indirizzo, quindi un'email non verificata dal provider non
  è un'identità su cui appoggiarla.

### Google OAuth — checklist di setup (Google Cloud Console)

1. [console.cloud.google.com](https://console.cloud.google.com) → crea/seleziona un progetto.
2. **APIs & Services → OAuth consent screen**: tipo "External", stato
   "Testing" va bene per uso familiare/self-hosted (evita la revisione di
   verifica Google, ma limita a max 100 utenti di test — sufficiente qui).
   Aggiungi come "Test user" ogni email Google che deve poter accedere
   (deve comunque essere anche in `allowed_emails`: OAuth autentica, non
   autorizza — vedi SPEC §2).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**,
   tipo "Web application".
4. **Authorized JavaScript origins**: l'origine pubblica dell'app, es.
   `https://wealthwatcher.tuodominio.it` (+ `http://localhost:3000` per lo
   sviluppo locale).
5. **Authorized redirect URIs**: `https://wealthwatcher.tuodominio.it/api/auth/callback/google`
   (+ `http://localhost:3000/api/auth/callback/google` per lo sviluppo).
   **Google richiede HTTPS per qualunque host diverso da `localhost`** — un
   dominio LAN servito in HTTP puro (es. `http://wealthwatcher.home.nf`,
   come discusso per `FORCE_HTTPS_UPGRADE`) non verrà accettato: serve un
   reverse proxy con TLS reale (es. Let's Encrypt) davanti all'istanza prima
   di poter usare Google OAuth fuori da `localhost`.
6. Copia "Client ID" e "Client secret" in `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`.
7. Nessuna variabile `AUTH_URL`/`NEXTAUTH_URL`: l'host del redirect è dedotto
   a runtime da `trustHost: true` (`src/auth.ts`) leggendo `X-Forwarded-Host`
   — il reverse proxy davanti all'app deve impostarlo correttamente.

## Cifratura a riposo

- **Segreti per-utente** (chiave OpenAI, chiave privata Enable Banking,
  session_id bancari) — AES-256-GCM, envelope versionato in
  `src/lib/crypto.ts`:
  - **v2 (corrente)**: chiave da `DATA_ENCRYPTION_KEY` (fallback
    `AUTH_SECRET`) con salt dedicato. Impostare `DATA_ENCRYPTION_KEY`
    permette di ruotare `AUTH_SECRET` (sessioni) senza invalidare i segreti
    già cifrati.
  - **v1 (legacy)**: formato precedente, derivato solo da `AUTH_SECRET`.
    `decryptSecret` lo riconosce e decifra ancora — nessuna migrazione
    forzata: ogni segreto passa a v2 la prossima volta che viene riscritto.
- **Backup del database** (`scripts/backup.ts`, `src/lib/backupCrypto.ts`):
  AES-256-GCM binario (IV|TAG|ciphertext), chiave da
  `BACKUP_ENCRYPTION_KEY` (fallback `AUTH_SECRET`, salt dedicato e diverso
  da quello dei segreti utente). Il `.db` intermedio in chiaro è solo
  transitorio e viene rimosso subito dopo la cifratura. Restore:
  `npm run restore-backup` (vedi `docs/backup.md`).
- **Dati non cifrati a livello di campo**: saldi, transazioni, reddito,
  patrimonio netto restano in chiaro nel DB SQLite (cifratura field-level
  scartata: romperebbe ordinamenti/aggregazioni SQL usati ovunque
  nell'app). La protezione è a livello di backup (sopra) e di volume/OS —
  documentare/valutare la cifratura del volume se l'host non è pienamente
  fidato.

## Minimizzazione dati

- **IBAN**: non persistito per intero. Se la banca non fornisce un nome
  conto, il fallback è un IBAN mascherato (`maskIban`,
  `src/lib/privacy.ts`), non l'IBAN completo.
- **Log**: le risposte dell'API Enable Banking non vengono mai loggate per
  intero (solo status + path); gli errori OpenAI vengono loggati per
  categoria (`auth`/`rate-limit`/`other`), mai come messaggio grezzo (può
  contenere frammenti della chiave o del prompt); il net worth per-utente
  non finisce nei log di `scripts/snapshot.ts` a meno di
  `SNAPSHOT_VERBOSE=1` esplicito.
- **Catalogo strumenti condiviso** (`instruments`, nessun `owner_id` — è
  reference data comune a tutti gli utenti): i campi KID (nome corretto,
  TER, costi, SRI) si possono solo *aggiungere* se ancora vuoti
  (`updateInstrumentKidFields`, `COALESCE`), mai sovrascrivere un valore già
  confermato da un altro utente — evita che un utente alteri silenziosamente
  dati visti da altri.

## Superfici esterne

- **Header di sicurezza + CSP**: HSTS, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
  sono statici (`next.config.ts`). La **Content-Security-Policy** è invece
  generata per-richiesta in `src/proxy.ts`, con un nonce fresco a ogni
  request (`script-src 'self' 'nonce-...' 'strict-dynamic'`) — **non**
  hash-based: Next.js App Router inietta propri script inline per
  l'hydration (payload RSC) con contenuto diverso a ogni render, che un hash
  statico non può coprire; Next.js propaga automaticamente il nonce ai
  propri script (vedi il commento in `src/proxy.ts` e la doc Next.js
  linkata lì). Il nonce viene letto in `app/layout.tsx` via `headers()` e
  passato all'unico script inline manuale dell'app (tema). Conseguenza:
  tutte le pagine sono renderizzate dinamicamente (leggere `headers()` nel
  layout root lo forza), incluse `/privacy` e `/terms` che prima erano
  statiche — costo trascurabile per un'app self-hosted a basso traffico.
  `img-src` include `https:` perché le icone crypto (CoinGecko) e le
  thumbnail news (Yahoo Finance) arrivano da domini di terze parti non
  elencabili in anticipo. **`upgrade-insecure-requests` non è incluso di
  default**: forzerebbe il browser a richiedere ogni asset (JS/CSS/font) via
  HTTPS sullo stesso host, e se l'istanza è servita in HTTP puro (es. dietro
  VPN senza TLS terminato) questo rompe l'intera pagina
  (`ERR_SSL_UNRECOGNIZED_NAME_ALERT` su ogni risorsa, osservato in
  produzione). Impostare `FORCE_HTTPS_UPGRADE=true` **solo** quando
  l'istanza è davvero raggiunta via HTTPS end-to-end.
- **Timeout** su tutte le fetch esterne (`src/lib/fetchWithTimeout.ts`,
  default 10s) — prezzi, Enable Banking, scraping AutoScout24.
- **Upload** (estratti conto, PDF KID): limiti di dimensione/estensione
  (`src/lib/uploads.ts`) — mitiga DoS via file enormi/zip-bomb.
- **`xlsx`**: migrato dalla distribuzione npm (0.18.5, due CVE HIGH note e
  senza fix su npm) alla distribuzione ufficiale SheetJS via CDN
  (`https://cdn.sheetjs.com`), che include entrambe le patch.

## Cosa NON è (ancora) coperto

- Cifratura field-level dei dati finanziari (scelta deliberata, vedi sopra).
- Rate limiting distribuito (l'app è single-processo/self-hosted: uno store
  condiviso tipo Redis servirebbe solo per un deploy multi-istanza).
- Pseudonimizzazione permanente delle descrizioni/controparti delle
  transazioni bancarie (restano in chiaro: servono per la categorizzazione e
  sono visibili solo al proprietario del conto).

## Conservazione ed erasure per l'utente

Vedi `/privacy` §6–7: i dati restano finché l'account esiste; l'eliminazione
di istituzione/conto/portafoglio cancella a cascata i movimenti collegati;
le chiavi API personali si rimuovono dalle Impostazioni; la disconnessione
Open Banking revoca anche la sessione lato Enable Banking. Non essendoci un
export "conto in un click", l'export/erasure completo passa dall'accesso
diretto al database SQLite (istanza self-hosted).
