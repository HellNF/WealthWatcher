# Fiscalità italiana degli investimenti e del patrimonio finanziario — 2025 e novità 2026

**Documento preparato per la verifica di un professionista (commercialista).**
Data di redazione: 11 luglio 2026. Perimetro: fiscalità di investimenti e patrimonio finanziario
(capital gain, redditi di capitale, imposte patrimoniali, monitoraggio fiscale). Escluse
volutamente: IRPEF generale sul lavoro, immobili (IMU/cedolare secca), IVA, successioni e donazioni,
tranne dove strettamente necessario per contestualizzare (es. scaglioni IRPEF per il regime
dichiarativo o la deducibilità previdenziale).

> ⚠️ **Avvertenza.** Questo documento è materiale di studio e ricerca prodotto con l'assistenza di
> un modello linguistico (Claude), incrociando fonti pubbliche reperibili online. **Non costituisce
> consulenza fiscale.** Ogni voce numerica (aliquota, soglia, scadenza) è accompagnata dalle fonti
> consultate; i punti dove le fonti sono discordanti o la norma non è ancora consolidata sono
> segnalati con ⚠️ **Da verificare** e vanno confermati da un professionista abilitato prima di
> qualunque uso operativo (dichiarazione dei redditi, versamenti F24, decisioni di investimento).
> Il documento nasce nel contesto dello sviluppo di **WealthWatcher**, un'app di tracking
> patrimoniale che implementa già un motore di calcolo fiscale semplificato: l'Appendice B elenca
> i valori codificati nell'app da far validare o correggere.

## Legenda quadri dichiarativi (Modello Redditi PF)

| Quadro | Contenuto |
|---|---|
| **RT** | Plusvalenze di natura finanziaria (redditi diversi, Art. 67 TUIR) — regime dichiarativo |
| **RM** | Redditi soggetti a tassazione separata e a imposta sostitutiva (es. interessi su conti esteri, proventi OICR esteri non armonizzati) — non compensabile con RT |
| **RW** | Monitoraggio fiscale delle attività detenute all'estero (conti, titoli, crypto) + calcolo IVAFE |
| **RL** | Redditi diversi non finanziari e altri redditi (citato per completezza) |

---

## 1. Il quadro generale: redditi di capitale vs redditi diversi

Il TUIR (D.P.R. 917/1986) distingue due categorie di proventi finanziari, con conseguenze pratiche
enormi sulla possibilità di compensare le perdite:

- **Redditi di capitale** (Art. 44 TUIR): dividendi, cedole/interessi su obbligazioni, interessi su
  conti correnti/depositi, proventi da OICR/fondi/ETF in **guadagno**. Sono tassati sul lordo
  percepito e **non ammettono la deduzione di costi o perdite**.
- **Redditi diversi di natura finanziaria** (Art. 67, comma 1, lett. c-bis/c-quinquies/c-sexies
  TUIR; determinazione base imponibile Art. 68 TUIR): plusvalenze da cessione di azioni,
  obbligazioni "sotto la pari", ETC/ETN, certificati, derivati, criptoattività. Qui plusvalenze e
  **minusvalenze si sommano algebricamente** e le minusvalenze nette sono riportabili.

Questa distinzione è la base di **tutte** le sezioni seguenti: la vera domanda da porsi per ogni
strumento non è "quanto pago" ma "in quale cassetto cade il provento, e posso compensarlo?".

Fonti: [Art. 67 TUIR — Brocardi](https://www.brocardi.it/testo-unico-imposte-redditi/titolo-i/capo-vii/art67.html); [Art. 68 TUIR — Brocardi](https://www.brocardi.it/testo-unico-imposte-redditi/titolo-i/capo-vii/art68.html); [Quadro RT — Agenzia delle Entrate](https://www.agenziaentrate.gov.it/portale/-/4-quadro-rt-45-plusvalenze-di-natura-finanziaria).

---

## 2. Imposta sostitutiva sulle plusvalenze (capital gain)

| Voce | Valore | Riferimento |
|---|---|---|
| Aliquota standard | **26%** | Art. 5, D.Lgs. 461/1997; in vigore dal 1° luglio 2014 |
| Aliquota agevolata | **12,5%** | Titoli di Stato italiani (BTP, BOT, CCT, CTZ) e Paesi "White List", buoni fruttiferi postali, bond BEI/organismi sovranazionali |
| Base imponibile | Corrispettivo − costo di acquisto (+ oneri accessori) | Art. 68 TUIR |

L'aliquota del 26% si applica a azioni, ETC/ETN, obbligazioni corporate, certificati e — fino al
2024 — criptoattività (per il 2025-2026 vedi §7, che ha una disciplina propria in evoluzione).
La 12,5% si applica a titoli di Stato italiani ed esteri "white list" (elenco Paesi che scambiano
informazioni fiscali con l'Italia, oltre 140 giurisdizioni nell'ultimo aggiornamento).

### ETF misti (aliquota sintetica)

Per gli ETF/fondi che investono in parte in titoli di Stato white list e in parte in altri asset,
si applica un'aliquota sintetica proporzionale alla quota "whitelist" (w, in %):

```
α(w) = (w/100 × 12,5%) + ((100−w)/100 × 26%)
```

Esempio: un ETF con 50% di titoli whitelist → aliquota sintetica 19,25%. Questa è la logica
codificata in WealthWatcher (`syntheticRate()` in `src/lib/tax/rates.ts`) — la formula è di uso
comune tra gli operatori del settore, ma la percentuale whitelist va determinata sul KIID/rendiconto
del fondo, dato non normativamente standardizzato: ⚠️ **da verificare con l'esperto la fonte e
l'aggiornamento periodico corretto della % whitelist per ciascun ETF in portafoglio**.

Fonti: [Studio Dalle Carbonare — 26% sulle plusvalenze](https://www.studiodallecarbonare.it/e-del-26-limposta-sostitutiva-sulle-plusvalenze/); [BTP Analisi — Aliquota 12,5%](https://btpanalisi.it/mercato-btp/daily-focus-btp-agenzia-delle-entrate-aliquota-125-titoli-di-stato); [QuiFinanza — White List 2026](https://quifinanza.it/fisco-tasse/white-list-2026/960433/).

---

## 3. Redditi di capitale

| Provento | Aliquota | Note |
|---|---|---|
| Dividendi azionari (qualunque % di partecipazione, per persone fisiche non imprenditori) | 26% | Sostituto d'imposta se intermediario italiano |
| Cedole obbligazioni corporate | 26% | |
| Cedole titoli di Stato italiani/white list | 12,5% | |
| Interessi su conti correnti e depositi | 26% | Anche per giacenze minime; nessuna franchigia |
| Proventi OICR/ETF **in utile** | 26% (o sintetica se whitelist) | Reddito di capitale — vedi asimmetria §4 |

Punto essenziale: **i redditi di capitale non sono mai compensabili con le minusvalenze**, a
prescindere dal regime fiscale (dichiarativo o amministrato). Se l'intermediario è estero, questi
proventi vanno riportati nel **quadro RM** (non RT) e restano non compensabili.

Fonte: [Quadro RM — Agenzia delle Entrate](https://telematici.agenziaentrate.gov.it/pdf/uni08/help/Quadro_RM.pdf); [Fiscomania — redditi esteri quadro RM](https://fiscomania.com/redditi-esteri-quadro-rm/).

---

## 4. ⚠️ L'asimmetria fiscale degli ETF/OICR — punto critico da far validare

Questo è il punto normativo più delicato incontrato nella ricerca, perché **le fonti secondarie
consultate sono discordanti tra loro** e il funzionamento corretto ha un impatto diretto sulla
strategia di tax-loss harvesting.

**Fatto non controverso**: le plusvalenze da ETF/OICR (armonizzati UE) sono **redditi di
capitale**, quindi tassate per intero e mai compensabili con minusvalenze pregresse o
contemporanee.

**Punto controverso — le minusvalenze da ETF/OICR**: le fonti trovate si dividono in due
posizioni:

1. **Posizione A (compensabile)**: la minusvalenza da ETF/OICR viene "convertita" in reddito
   diverso ed è quindi compensabile con altre plusvalenze da redditi diversi entro 4 anni — questa
   è la logica attualmente implementata in WealthWatcher (`incomeType()` in
   `src/lib/tax/rates.ts`: "ETF loss → reddito diverso, offset-eligible, genera credito").
2. **Posizione B (non compensabile)**: la minusvalenza da ETF/OICR ha "la stessa natura fiscale"
   della plusvalenza (reddito di capitale) e **non è compensabile con nulla** — è semplicemente
   persa, essendo questa un'asimmetria voluta dal legislatore in cambio della tassazione
   semplificata alla fonte tipica dei fondi.

Entrambe le posizioni sono presenti, a volte nello stesso articolo, in fonti divulgative
(Wallible, LeggeInChiaro). Non sono riuscito a isolare, tramite ricerca pubblica, una circolare
dell'Agenzia delle Entrate o un testo di legge (es. Art. 68, comma 6, TUIR come modificato da
D.Lgs. 44/2014 sugli OICVM armonizzati UE) che risolva la questione in modo univoco e leggibile
senza assistenza professionale.

**⚠️ Azione richiesta all'esperto**: confermare se, per un ETF UCITS armonizzato UE detenuto in
regime dichiarativo o amministrato, una minusvalenza realizzata generi credito d'imposta
compensabile (zainetto) oppure no. Questo determina se la logica di tax-loss harvesting
dell'app (§13, Appendice B) è corretta o va disattivata/corretta per il cluster `etf`.

Fonti consultate (discordanti tra loro): [Wallible — minusvalenze ETF](https://www.wallible.com/blog/minusvalenze-etf-compensazione/); [LeggeInChiaro — ETF e fondi comuni 2026](https://leggeinchiaro.it/tassazione-etf-fondi-comuni-dichiarazione/); [FiscoInvestimenti — ETF 2026](https://fiscoinvestimenti.it/etf-tassazione-2026-armonizzati-accumulazione/).

> 💬 **Commento (revisione esterna, 14/07/2026)** — punto risolto a favore della **Posizione A**, ma
> con una precisazione decisiva sulla *direzione* della compensazione:
>
> **Le minusvalenze da ETF finiscono tutte nello zainetto fiscale** (sono redditi diversi,
> compensabili entro 4 anni). La particolarità è l'**asimmetria interna al mondo ETF**: la
> minusvalenza di un ETF **non** può essere compensata con la plusvalenza di un altro ETF — perché
> la plusvalenza ETF è *reddito di capitale*, mentre la minusvalenza ETF è *reddito diverso*, e le
> due categorie non si toccano mai. La minusvalenza ETF può quindi essere usata **solo** contro
> plusvalenze di altri strumenti a "reddito diverso": azioni, obbligazioni (sotto la pari),
> ETC/ETN, certificati, criptoattività.
>
> In sintesi: *ETF plus → reddito di capitale, non compensabile con nulla; ETF minus → zainetto,
> compensabile con tutto tranne che con plus di ETF/OICR.* Questo conferma la logica
> `incomeType()` dell'app (ETF gain=capitale, ETF loss=diverso/compensabile), a condizione che il
> motore **non** ammetta l'uso di una minus ETF per abbattere una plus ETF (vedi Appendice B).
>
> Fonte a supporto: [justETF — La fiscalità degli ETF in Italia](https://www.justetf.com/it/news/etf/la-fiscalita-degli-etf-in-italia.html)
> («ha reso impossibile la compensazione tra proventi di ETF — sia interessi che plusvalenze — con
> le minusvalenze derivanti da operazioni in perdita con gli ETF»).

---

## 5. Minusvalenze e "zainetto fiscale"

- Le minusvalenze da **redditi diversi** (azioni, ETC/ETN, certificati, obbligazioni sotto la
  pari, criptoattività, e — si veda §4 — potenzialmente ETF secondo la Posizione A) sono
  compensabili con plusvalenze della stessa categoria realizzate **nello stesso anno o nei 4 anni
  successivi**.
- **Scadenza**: una minusvalenza realizzata nell'anno X è utilizzabile fino al **31 dicembre
  dell'anno X+4** (Art. 68, comma 5, TUIR). Es.: minusvalenza del 2024 → utilizzabile fino al
  31/12/2028.
- La compensazione avviene per categoria omogenea (redditi diversi di natura finanziaria); non è
  possibile compensare redditi di capitale con redditi diversi in nessun caso.
- Nel **regime amministrato**, la compensazione automatica delle minusvalenze pregresse presso lo
  stesso intermediario avviene solo se il "credito" (zainetto) è stato regolarmente comunicato/
  trasferito; in caso di cambio intermediario serve il modulo di trasferimento del "plusvalore/
  minusvalore fiscale".

Questa è la logica di `src/lib/tax/wallet.ts` in WealthWatcher (compensazione FIFO per scadenza) —
coerente con quanto trovato, salvo il punto ETF del §4.

> 💬 **Commento (revisione esterna, 14/07/2026)** — anche le minusvalenze ETF entrano nello
> zainetto (§4), quindi la compensazione FIFO per scadenza è corretta; l'unico vincolo aggiuntivo è
> che la controparte di una minus ETF non può essere una plus ETF/OICR (reddito di capitale). In
> pratica il "cassetto" di destinazione delle minus è unico (redditi diversi), ma alcune
> plusvalenze — quelle di ETF/OICR — semplicemente **non entrano mai** in quel cassetto e restano
> tassate per intero.

Fonti: [Art. 68 TUIR — Brocardi](https://www.brocardi.it/testo-unico-imposte-redditi/titolo-i/capo-vii/art68.html); [Fiscomania — recupero minusvalenze](https://fiscomania.com/minusvalenze-finanziarie-recupero-compensazione/); [IoInvesto — recuperare minusvalenze pregresse](https://ioinvesto.net/blog/come-recuperare-le-minusvalenze-pregresse).

---

## 6. Regimi di tassazione: dichiarativo, amministrato, gestito

| Regime | Chi calcola/versa l'imposta | Compensazione minus | Dichiarazione |
|---|---|---|---|
| **Amministrato** | L'intermediario (banca/SIM), che agisce da sostituto d'imposta | Automatica presso lo stesso intermediario | Nessun obbligo di dichiarare i redditi finanziari coperti dal regime |
| **Dichiarativo** | Il contribuente, in autonomia | Manuale, tramite quadro RT | Obbligatorio: quadro RT (+ RM per redditi esteri, RW per monitoraggio) |
| **Gestito** | Il gestore, sul risultato di gestione maturato (non realizzato) a fine anno, al netto dei costi | Automatica sul risultato di gestione complessivo | Nessun obbligo salvo eccezioni |

Le aliquote (26% / 12,5% / sintetica) sono identiche nei tre regimi: cambia **chi** versa e
**quando**, non quanto si paga in assoluto. È rilevante per la scelta del profilo fiscale
dell'utente in WealthWatcher (`user_settings.capital_gains_regime`).

Fonti: [Fiscomania — regime dichiarativo/amministrato](https://fiscomania.com/capital-gain-regime-dichiarativo-amministrato/); [Directa — guida regime fiscale](https://www.directa.it/help-supporto/fiscalita/regime-fiscale).

---

## 7. Criptovalute — disciplina in forte evoluzione 2025→2026

Questa è l'area con i cambiamenti normativi più rapidi e con il maggior numero di **discrepanze
rispetto ai valori attualmente codificati in WealthWatcher**.

| Periodo | Aliquota | Franchigia annua |
|---|---|---|
| 2023–2024 | 26% | €2.000 (sotto soglia: nessuna imposta) |
| **2025** | **26%** | **Abolita dal 1° gennaio 2025** — tassabile ogni plusvalenza, anche minima |
| **2026 in poi** | **33%** (26% per gli e-money token in euro, MiCAR) | Abolita |

- Base normativa: Art. 67, comma 1, lett. c-sexies, TUIR (introdotta dalla L. 197/2022, Legge di
  Bilancio 2023).
- **Abolizione della franchigia** e **innalzamento al 33% dal 2026**: introdotti dalla Legge di
  Bilancio 2025 (L. 207/2024) e confermati/precisati dalla Legge di Bilancio 2026 (art. 13), che ha
  aggiunto l'eccezione al 26% per i "token di moneta elettronica denominati in euro" conformi al
  Regolamento UE 2023/1114 (MiCAR); le conversioni tra euro ed e-money token non generano
  plusvalenza, essendo considerate "una diversa forma di detenzione della stessa valuta".
- **Rivalutazione al 1° gennaio 2025**: possibilità (opzionale) di rivalutare il costo fiscale
  delle cripto possedute al 1/1/2025 al valore di mercato, pagando un'imposta sostitutiva del 18%
  — utile per chi ha forti plusvalenze latenti pregresse.
- **Monitoraggio fiscale**: obbligo di compilazione del quadro RW **dal primo euro**, per ogni
  wallet/exchange (italiano, estero, self-custody). La soglia di esonero di €10.000 valida per i
  conti bancari esteri **non si applica** alle criptoattività.
- **Imposta patrimoniale sulle cripto (equivalente IVAFE)**: 2‰ del valore al 31/12, indicata in
  alcune fonti recenti come "IVCA" (Imposta sul Valore delle Cripto-Attività) — ⚠️ da verificare
  se questa nomenclatura è già formalizzata o solo giornalistica.
- **Documentazione**: senza prova del costo di acquisto, il costo si considera pari a zero e si
  tassa l'intero corrispettivo.

**⚠️ Discrepanza con il codice dell'app**: `CRYPTO_FRANCHIGIA_EUR_MINOR = 200_000` (€2.000) in
`src/lib/tax/rates.ts` è **superata dal 1° gennaio 2025** — la franchigia non esiste più. Inoltre
`RATE_STANDARD = 0.26`, usato anche per il cluster `crypto`, sarà **superato dal 1° gennaio 2026**
(l'aliquota crypto sale al 33%, diversa dal 26% che resta invece corretto per azioni/ETC/bond
corporate). Vedi Appendice B per il dettaglio.

Fonti: [Fiscomania — tassazione crypto 33% dal 2026](https://fiscomania.com/tassazione-crypto-cosa-cambia/); [Agenda Digitale — Legge di Bilancio 2026 crypto](https://www.agendadigitale.eu/cultura-digitale/tassazione-criptovalute-cosa-cambia-con-la-legge-di-bilancio-2026/); [Studio Forte — addio franchigia 2.000€](https://www.studioforte.net/blog/plusvalenze-da-cripto-attivita-addio-alla-franchigia-di-2-000-euro-dal-2025/); [MoneyViz — quadro RW crypto 2026](https://blog.moneyviz.it/quadro-rw-crypto-2026-guida-compilazione-completa/).

---

## 8. Imposta di bollo e IVAFE

| Voce | Aliquota/importo | Soglia | Riferimento |
|---|---|---|---|
| Bollo conti correnti/libretti (persone fisiche, intermediario italiano) | €34,20 fisso annuo, pro-rata sui giorni di apertura | Giacenza media annua > €5.000 | Art. 13, c. 2-bis, D.P.R. 642/1972 |
| Bollo dossier titoli (intermediario italiano) | 0,2% annuo del controvalore al 31/12 | Nessuna soglia minima | Art. 13, c. 2-ter, D.P.R. 642/1972 |
| IVAFE — conti correnti esteri | €34,20 fisso (persona fisica) / €100 (altri soggetti) | Giacenza media > €5.000 | Art. 19, c. 18, D.L. 201/2011 |
| IVAFE — prodotti finanziari esteri | 0,2% annuo del valore al 31/12 (0,4% se Stato a fiscalità privilegiata, dal 2024) | Nessuna soglia | Art. 19, c. 18 e ss., D.L. 201/2011; L. 213/2023 (Bilancio 2024) per la maggiorazione |

**Principio di reciproca esclusione**: uno stesso strumento non può essere soggetto sia a bollo che
a IVAFE — il discrimine è la residenza fiscale/localizzazione dell'intermediario (Italia = bollo;
estero = IVAFE), esattamente come implementato in WealthWatcher tramite `institutions.country`
(`isForeign()` in `rates.ts`).

**⚠️ Novità 2026 — ricodificazione formale (non sostanziale)**: dal 1° gennaio 2026 la disciplina
di bollo/IVAFE, storicamente nel D.L. 201/2011, confluisce nel nuovo **Testo Unico dei tributi
erariali minori** (D.Lgs. 123/2025, art. 168), che a quanto risulta dalle fonti consultate **non
modifica sostanzialmente le aliquote**, ma va confermato che non ci siano micro-variazioni sfuggite
alla ricerca (es. sulla maggiorazione 0,4% per Stati a fiscalità privilegiata).

È presente credito d'imposta per le imposte patrimoniali analoghe già pagate all'estero, fino a
concorrenza dell'IVAFE dovuta in Italia.

Fonti: [Agenzia delle Entrate — Scheda IVAFE](https://www.agenziaentrate.gov.it/portale/schede/pagamenti/imposta-valore-att-estero-ivafe/base-imponibile-e-aliquote-scheda-ivafe); [Fiscomania — bollo e IVAFE 2026](https://fiscomania.com/imposta-bollo-strumenti-finanziari/); [QuiFinanza — bollo/IVAFE 2026](https://quifinanza.it/fisco-tasse/imposta-bollo-ivafe-prodotti-finanziari-2026/1005389/).

---

## 9. Monitoraggio fiscale — Quadro RW

- Obbligo per ogni persona fisica fiscalmente residente in Italia che detiene attività finanziarie
  e patrimoniali all'estero (conti, titoli, immobili, criptoattività), indipendentemente dal fatto
  che generino redditi imponibili.
- **Soglia di esonero conti correnti/libretti esteri**: €10.000 di valore massimo raggiunto
  nell'anno — **non applicabile alle criptoattività**, per cui l'obbligo scatta dal primo euro
  detenuto su qualunque wallet o exchange, anche self-custody (Ledger, Trezor, MetaMask) o su
  piattaforme estere (Binance, Kraken, Coinbase, ecc.).
- **Sanzioni** per omessa/infedele compilazione: dal **3% al 15%** dell'importo non dichiarato
  (raddoppiate, 6%-30%, per attività detenute in Paesi black list).
- Dal 1° gennaio 2026, il D.Lgs. 194/2025 introduce obblighi di identificazione/comunicazione a
  carico dei prestatori di servizi per le cripto-attività (CASP), che presumibilmente
  faciliteranno l'incrocio dati da parte dell'Agenzia delle Entrate.
- Il quadro RW è anche la base di calcolo per IVAFE (§8) e IVIE (immobili, fuori perimetro di
  questo documento).

**⚠️ Nota per l'app**: WealthWatcher non sembra modellare esplicitamente l'obbligo dichiarativo RW
in sé (che è un obbligo di monitoraggio, non un calcolo d'imposta), ma calcola già IVAFE — ha
senso valutare se aggiungere un promemoria/reminder per la compilazione RW, specialmente per i
wallet crypto collegati.

Fonti: [MoneyViz — quadro RW crypto 2026](https://blog.moneyviz.it/quadro-rw-crypto-2026-guida-compilazione-completa/); [Agenzia delle Entrate — Istruzioni Quadro RW](https://telematici.agenziaentrate.gov.it/webuni/pdf/help/15/Quadro_RW.pdf); [ODCEC Torino — monitoraggio fiscale e quadro RW](https://odcec.torino.it/public/convegni/lago_quadro_rw_e_monitoraggio_fiscale_slides_convegno_odcec_17.06.2025.pdf).

---

## 10. Previdenza complementare

| Voce | Valore 2025 | Valore 2026 | Riferimento |
|---|---|---|---|
| Deducibilità IRPEF contributi fondo pensione | €5.164,57/anno | **€5.300/anno** (dal 1/1/2026, in vigore formalmente dal 1/7/2026 con effetto retroattivo su tutto il 2026) | Art. 10, c. 1, lett. e-bis, TUIR |
| Extra-deduzione lavoratori di prima occupazione | metà del plafond ordinario | €2.650/anno (metà di 5.300) | idem |

Il limite €5.164,57 era invariato dal 2007; la Legge di Bilancio 2026 lo aggiorna per la prima
volta in quasi vent'anni. Il TFR conferito al fondo resta escluso dal plafond (versato in
sospensione d'imposta).

**⚠️ Discrepanza con il codice dell'app**: `MAX_PENSION_DEDUCTION_EUR_MINOR = 516_457` (€5.164,57)
in `src/lib/tax/rates.ts` è corretto per il 2025 ma **da aggiornare a €5.300 per l'anno d'imposta
2026**.

Fonti: [LaLeggePerTutti — fondi pensione 5.300€](https://www.laleggepertutti.it/787326_fondi-pensione-sale-a-5-300-euro-il-limite-di-deducibilita-fiscale); [Previdir — nuovo plafond 5.300€](https://www.previdir.it/previdenza-complementare-sale-a-5-300-euro-il-nuovo-plafond-di-deducibilita/); [Mefop — deducibilità post Legge di Bilancio 2026](https://www.mefop.it/blog/blog-mefop/deducibilita-extradeducibilita-post-legge-bilancio-2026).

---

## 11. IRPEF — cenni per il regime dichiarativo/forfettario collegato agli investimenti

Rilevante solo perché lo status IRPEF dell'utente (scaglione marginale) influisce sulle scelte di
investimento e sul regime forfettario di chi ha reddito da lavoro autonomo.

| Scaglione | Aliquota 2025 | Aliquota 2026 |
|---|---|---|
| Fino a €28.000 | 23% | 23% (invariato) |
| €28.001–€50.000 | 35% | **33%** (dal 2026) |
| Oltre €50.000 | 43% | 43% (invariato) |

Regime forfettario (per chi ha reddito da lavoro autonomo/partita IVA, con ricavi/compensi fino a
€85.000): imposta sostitutiva **15%** (ordinaria) o **5%** per i primi 5 anni di nuova attività
("regime start-up", a condizioni di legge); reddito imponibile = ricavi × coefficiente di
redditività (40%-86% secondo codice ATECO), sostituisce IRPEF, addizionali e IRAP.

**⚠️ Discrepanza con il codice dell'app**: `IRPEF_BRACKETS` in `src/lib/tax/rates.ts` ha
23%/35%/43% — corretto per il 2025, ma **il secondo scaglione scende dal 35% al 33% dal 2026**
(Legge di Bilancio 2026). `FORFETTARIO_RATE_STD = 0.15` e `FORFETTARIO_RATE_STARTUP = 0.05` sono
coerenti con quanto trovato. `ADDIZIONALI_STIMATE_RATE = 0.02` è una stima forfettaria dichiarata
tale nel codice — corretto trattarla come approssimazione, dato che le addizionali comunali/
regionali variano per comune (da verificare se il 2% è una media ragionevole o va parametrizzato).

Fonti: [FiscoeTasse — IRPEF 2025 tre aliquote](https://www.fiscoetasse.com/new-rassegna-stampa/1034-irpef-2025-le-3-aliquote-e-gli-scaglioni.html); [LaLeggePerTutti — nuovi scaglioni IRPEF 2025-2026](https://www.laleggepertutti.it/796713_nuovi-scaglioni-irpef-2025-e-2026-quali-aliquote-si-applicano-al-tuo-reddito); [Regimeminimi — regime forfettario 2025](https://www.regimeminimi.com/regime-forfettario-2025-partita-iva/).

---

## 12. Scadenzario e adempimenti (regime dichiarativo)

| Adempimento | Scadenza indicativa | Note |
|---|---|---|
| Versamento imposta sostitutiva capital gain (saldo) | 30 giugno dell'anno successivo | Tramite F24, no rateazione per il saldo puro |
| Dichiarazione dei redditi (quadri RT/RM/RW) | Termini ordinari Modello Redditi PF (autunno) | |
| Bollo dossier titoli / IVAFE su prodotti finanziari | Addebito automatico dall'intermediario (regime amministrato) o autoliquidazione (dichiarativo) | 0,2% al 31/12 |
| Imposta sulle cripto-attività (se rateizzata, quota codificata "IC") | 2 rate: 40% + 60% entro il 30 novembre | ⚠️ Da verificare la fonte normativa esatta di questa rateazione |
| Codici tributo F24 crypto | 1715 (plusvalenze), 1727-1729, IVAFE 4043-4048 | ⚠️ Verificare validità/aggiornamento dei codici per l'anno di presentazione |

Fonti: [Agenzia delle Entrate — scadenzario versamento imposta sostitutiva](https://www1.agenziaentrate.gov.it/servizi/scadenzario/main.php?op=4&chi=2859&cosa=75&come=292&entroil=30-06-2021); [MoneyViz — codici tributo F24 crypto 2026](https://blog.moneyviz.it/codici-tributo-f24-crypto-2026-guida-completa/).

---

## 13. Appendice A — Tabella di sintesi dei valori chiave

| Voce | Valore | Vigenza | Riferimento |
|---|---|---|---|
| Capital gain standard | 26% | 2025-2026 | Art. 5 D.Lgs. 461/1997 |
| Capital gain agevolata (titoli whitelist) | 12,5% | 2025-2026 | Art. 67-68 TUIR |
| Dividendi/interessi (redditi di capitale) | 26% (12,5% se whitelist) | 2025-2026 | Art. 44 TUIR |
| Franchigia crypto | €2.000 → **abolita** | Fino al 2024; abolita dal 2025 | L. 207/2024 |
| Aliquota crypto | 26% → **33%** (26% e-money token euro) | 26% nel 2025; 33% dal 2026 | L. 207/2024; L. Bilancio 2026 art. 13 |
| Scadenza minusvalenze | 4 anni (31/12 anno X+4) | invariato | Art. 68 c.5 TUIR |
| Bollo conti | €34,20, soglia giacenza media €5.000 | invariato | Art. 13 c.2-bis DPR 642/1972 → dal 2026 art. 168 TU tributi minori (D.Lgs. 123/2025) |
| Bollo/IVAFE titoli | 0,2% (0,4% se Stato a fiscalità privilegiata) | invariato | DL 201/2011 art. 19 c.18 → dal 2026 come sopra |
| Deducibilità fondo pensione | €5.164,57 → **€5.300** | 2025: 5.164,57; 2026: 5.300 | Art. 10 c.1 lett. e-bis TUIR; L. Bilancio 2026 |
| IRPEF 2° scaglione | 35% → **33%** | 2025: 35%; 2026: 33% | L. Bilancio 2025/2026 |
| Regime forfettario | 15% (5% start-up) | invariato | L. 190/2014 e succ. mod. |
| Soglia esonero RW conti esteri | €10.000 (non vale per crypto) | invariato | D.L. 167/1990 e succ. mod. |
| Sanzione RW | 3%-15% (6%-30% se black list) | invariato | D.L. 167/1990 |

---

## Appendice B — Valori codificati in WealthWatcher da validare

Riferimento: `src/lib/tax/rates.ts` (letto in sola lettura, nessuna modifica effettuata).

| Costante nel codice | Valore attuale | Esito verifica incrociata |
|---|---|---|
| `RATE_STANDARD` | 0.26 | ✅ Corretto per azioni/ETC/bond corporate. ⚠️ Per `cluster='crypto'` è corretto solo per il 2025 — dal 2026 la crypto sale al 33% (con eccezione 26% per e-money token euro), mentre lo standard resta 26% per gli altri strumenti: **serve una costante separata per l'aliquota crypto 2026**. |
| `RATE_WHITELIST` | 0.125 | ✅ Confermato da più fonti. |
| `syntheticRate()` | formula α(w) | ✅ Formula coerente con la prassi; ⚠️ verificare la fonte/aggiornamento della % whitelist per ETF specifici. |
| `CRYPTO_FRANCHIGIA_EUR_MINOR` | €2.000 | ❌ **Superata**: la franchigia crypto è abolita dal 1° gennaio 2025. Andrebbe rimossa/azzerata per gli anni fiscali ≥2025. |
| `expiryDate()` | 4 anni, 31/12 anno X+4 | ✅ Confermato, Art. 68 c.5 TUIR. |
| `incomeType()` (asimmetria ETF) | ETF gain=capitale, ETF loss=diverso (compensabile) | ✅ **Confermato** dalla revisione esterna (§4, commento 14/07/2026 + fonte justETF): la minus ETF è compensabile (zainetto). ⚠️ **Verificare nel motore** che una minus ETF **non** venga usata per abbattere una plus ETF/OICR (reddito di capitale): la controparte ammessa deve essere solo azioni/bond sotto la pari/ETC-ETN/certificati/crypto. |
| `BOLLO_CONTI_EUR_MINOR` | €34,20 | ✅ Confermato. |
| `BOLLO_SOGLIA_EUR_MINOR` | €5.000 | ✅ Confermato. |
| `BOLLO_TITOLI_RATE` | 0,2% | ✅ Confermato (anche per IVAFE standard). ⚠️ Manca la maggiorazione allo 0,4% per Stati a fiscalità privilegiata (introdotta dal 2024) — l'app non sembra distinguere questo caso. |
| `isForeign()` | IT=bollo, altro=IVAFE | ✅ Logica coerente col principio di reciproca esclusione. |
| `MAX_PENSION_DEDUCTION_EUR_MINOR` | €5.164,57 | ⚠️ Corretto per il 2025; **da aggiornare a €5.300 per il 2026**. |
| `IRPEF_BRACKETS` | 23% / 35% / 43% | ⚠️ Corretto per il 2025; **il secondo scaglione scende al 33% dal 2026**. |
| `FORFETTARIO_RATE_STD` / `_STARTUP` | 15% / 5% | ✅ Confermati. |
| `ADDIZIONALI_STIMATE_RATE` | 2% (stima) | ℹ️ Dichiarato come stima nel codice stesso — nessuna verifica puntuale possibile (varia per comune); ragionevole come default. |

---

## Fonti consultate

**Fonti primarie**
- Agenzia delle Entrate — [Scheda IVAFE](https://www.agenziaentrate.gov.it/portale/schede/pagamenti/imposta-valore-att-estero-ivafe/base-imponibile-e-aliquote-scheda-ivafe)
- Agenzia delle Entrate — [Quadro RT](https://www.agenziaentrate.gov.it/portale/-/4-quadro-rt-45-plusvalenze-di-natura-finanziaria)
- Agenzia delle Entrate — [Istruzioni Quadro RM](https://telematici.agenziaentrate.gov.it/pdf/uni08/help/Quadro_RM.pdf)
- Agenzia delle Entrate — [Istruzioni Quadro RW](https://telematici.agenziaentrate.gov.it/webuni/pdf/help/15/Quadro_RW.pdf)
- Agenzia delle Entrate — [Scadenzario versamento imposta sostitutiva](https://www1.agenziaentrate.gov.it/servizi/scadenzario/main.php?op=4&chi=2859&cosa=75&come=292&entroil=30-06-2021)
- Brocardi.it (riproduzione testo TUIR) — [Art. 67](https://www.brocardi.it/testo-unico-imposte-redditi/titolo-i/capo-vii/art67.html), [Art. 68](https://www.brocardi.it/testo-unico-imposte-redditi/titolo-i/capo-vii/art68.html)

**Fonti secondarie (corroboranti)**
- [Fiscomania — regime dichiarativo/amministrato](https://fiscomania.com/capital-gain-regime-dichiarativo-amministrato/)
- [Fiscomania — bollo e IVAFE 2026](https://fiscomania.com/imposta-bollo-strumenti-finanziari/)
- [Fiscomania — tassazione crypto 2026](https://fiscomania.com/tassazione-crypto-cosa-cambia/)
- [Fiscomania — minusvalenze finanziarie](https://fiscomania.com/minusvalenze-finanziarie-recupero-compensazione/)
- [Agenda Digitale — crypto Legge di Bilancio 2026](https://www.agendadigitale.eu/cultura-digitale/tassazione-criptovalute-cosa-cambia-con-la-legge-di-bilancio-2026/)
- [QuiFinanza — White List 2026](https://quifinanza.it/fisco-tasse/white-list-2026/960433/)
- [QuiFinanza — bollo/IVAFE 2026](https://quifinanza.it/fisco-tasse/imposta-bollo-ivafe-prodotti-finanziari-2026/1005389/)
- [MoneyViz — quadro RW crypto 2026](https://blog.moneyviz.it/quadro-rw-crypto-2026-guida-compilazione-completa/)
- [MoneyViz — codici tributo F24 crypto 2026](https://blog.moneyviz.it/codici-tributo-f24-crypto-2026-guida-completa/)
- [Studio Forte — addio franchigia crypto](https://www.studioforte.net/blog/plusvalenze-da-cripto-attivita-addio-alla-franchigia-di-2-000-euro-dal-2025/)
- [LaLeggePerTutti — scaglioni IRPEF 2025-2026](https://www.laleggepertutti.it/796713_nuovi-scaglioni-irpef-2025-e-2026-quali-aliquote-si-applicano-al-tuo-reddito)
- [LaLeggePerTutti — fondi pensione 5.300€](https://www.laleggepertutti.it/787326_fondi-pensione-sale-a-5-300-euro-il-limite-di-deducibilita-fiscale)
- [Previdir — nuovo plafond fondo pensione](https://www.previdir.it/previdenza-complementare-sale-a-5-300-euro-il-nuovo-plafond-di-deducibilita/)
- [Mefop — deducibilità post Legge di Bilancio 2026](https://www.mefop.it/blog/blog-mefop/deducibilita-extradeducibilita-post-legge-bilancio-2026)
- [Regimeminimi — regime forfettario 2025](https://www.regimeminimi.com/regime-forfettario-2025-partita-iva/)
- [Wallible — minusvalenze ETF](https://www.wallible.com/blog/minusvalenze-etf-compensazione/)
- [LeggeInChiaro — ETF e fondi comuni 2026](https://leggeinchiaro.it/tassazione-etf-fondi-comuni-dichiarazione/)
- [ODCEC Torino — monitoraggio fiscale e quadro RW](https://odcec.torino.it/public/convegni/lago_quadro_rw_e_monitoraggio_fiscale_slides_convegno_odcec_17.06.2025.pdf)

---

## Riepilogo dei punti a priorità massima per l'esperto

1. **§4 — Compensabilità delle minusvalenze ETF/OICR**: ~~fonti discordanti~~ → **risolto**
   (revisione esterna 14/07/2026 + justETF): la minus ETF è compensabile (zainetto), ma **non**
   contro plus di ETF/OICR (reddito di capitale). Resta da verificare nel motore che il tax-loss
   harvesting non appaii mai una minus ETF a una plus ETF.
2. **§7 — Aliquota crypto 2026 (33%)**: verificare se già in vigore in modo definitivo o soggetta
   a ulteriori modifiche in sede di conversione/attuazione; l'app usa ancora 26% fisso.
3. **§7 — Franchigia crypto abolita dal 2025**: l'app applica ancora €2.000 di franchigia.
4. **§10/§11 — Aggiornamenti 2026** (fondo pensione €5.300, IRPEF 33% secondo scaglione): da
   introdurre nell'app come valori parametrizzati per anno fiscale, non costanti fisse.
