# Integrazione con Homepage (gethomepage.dev)

WealthWatcher espone una suite di endpoint JSON in sola lettura, pensati per il
widget [`customapi`](https://gethomepage.dev/widgets/services/customapi/) di
[Homepage](https://gethomepage.dev/) — la dashboard self-hosted per il
monitoring di server e servizi. Con questi endpoint puoi mostrare patrimonio
netto, capitale investito, incremento, cashflow, obiettivi e scadenze
direttamente nella tua Homepage, accanto agli altri servizi che monitori.

Funziona anche con qualunque altro strumento in grado di chiamare un'API JSON
con un header custom (Grafana Infinity datasource, script personali, ecc.).

## 1. Genera un token

1. Vai in **Impostazioni → Accesso API · Homepage**.
2. Dai un nome al token (es. "Homepage salotto") e premi **Genera token**.
3. Copia il valore mostrato: **non sarà più visibile dopo aver lasciato la pagina**.
   Se lo perdi, revoca il token e creane uno nuovo.

Il token dà accesso in **sola lettura** al patrimonio dell'utente che lo ha
creato — trattalo come una password. Revocalo dalla stessa pagina in
qualunque momento se sospetti sia stato esposto.

> ⚠️ **Esponi WealthWatcher solo su rete fidata (LAN/VPN, es. Tailscale).**
> Chiunque intercetti il token in transito ottiene lettura completa del tuo
> patrimonio. Non incollare il token in un `services.yaml` versionato su git:
> usa il meccanismo delle variabili d'ambiente di Homepage (vedi sotto).

## 2. Autenticazione

Ogni endpoint (tranne `/ping`) richiede il token in uno di questi due modi:

```
X-API-Key: ww_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
oppure
```
Authorization: Bearer ww_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Senza header, e se hai una sessione browser attiva, l'endpoint funziona
comunque (utile per aprirlo nel browser e controllare i campi prima di
configurare Homepage) — ma per Homepage stesso serve sempre il token, dato
che le chiamate partono dal server di Homepage, non dal tuo browser.

Limite: 120 richieste al minuto per utente. Oltre, risposta `429` con header
`Retry-After`.

## 3. `services.yaml` — copia e incolla

Sostituisci `https://ww.example.net` con l'URL della tua istanza e imposta il
token come variabile d'ambiente di Homepage (`HOMEPAGE_VAR_WW_TOKEN` nel
`.env` di Homepage), così il token non finisce mai nel file versionato.

```yaml
- Finanza:
    - WealthWatcher:
        icon: mdi-finance
        href: https://ww.example.net/dashboard
        description: Patrimonio netto
        siteMonitor: https://ww.example.net/api/homepage/v1/ping
        widget:
          type: customapi
          url: https://ww.example.net/api/homepage/v1/summary
          refreshInterval: 300000
          headers:
            X-API-Key: "{{HOMEPAGE_VAR_WW_TOKEN}}"
          mappings:
            - field: netWorth
              label: Patrimonio
              format: float
              prefix: "€ "
            - field: change.1m.pct
              label: 30 giorni
              format: percent
            - field: invested
              label: Investito
              format: float
              prefix: "€ "
            - field: unrealizedPlPct
              label: P/L
              format: percent

    - WealthWatcher Portafogli:
        icon: mdi-chart-line
        href: https://ww.example.net/dashboard/portfolios
        widget:
          type: customapi
          url: https://ww.example.net/api/homepage/v1/portfolios
          refreshInterval: 300000
          headers:
            X-API-Key: "{{HOMEPAGE_VAR_WW_TOKEN}}"
          display: dynamic-list
          mappings:
            items: items
            name: name
            label: label

    - WealthWatcher Conti:
        icon: mdi-bank
        href: https://ww.example.net/dashboard/accounts
        widget:
          type: customapi
          url: https://ww.example.net/api/homepage/v1/accounts
          refreshInterval: 300000
          headers:
            X-API-Key: "{{HOMEPAGE_VAR_WW_TOKEN}}"
          display: dynamic-list
          mappings:
            items: items
            name: name
            label: label

    - WealthWatcher Cashflow:
        icon: mdi-cash-multiple
        href: https://ww.example.net/dashboard/reports
        widget:
          type: customapi
          url: https://ww.example.net/api/homepage/v1/cashflow
          refreshInterval: 300000
          headers:
            X-API-Key: "{{HOMEPAGE_VAR_WW_TOKEN}}"
          mappings:
            - field: income
              label: Entrate
              format: float
              prefix: "€ "
            - field: expenses
              label: Uscite
              format: float
              prefix: "€ "
            - field: savingsRatePct
              label: Risparmio
              format: percent
            - field: runway.months
              label: Autonomia (mesi)
              format: float

    - WealthWatcher Obiettivi:
        icon: mdi-target
        href: https://ww.example.net/dashboard/obiettivi
        widget:
          type: customapi
          url: https://ww.example.net/api/homepage/v1/goals
          refreshInterval: 300000
          headers:
            X-API-Key: "{{HOMEPAGE_VAR_WW_TOKEN}}"
          display: dynamic-list
          mappings:
            items: items
            name: name
            label: label

    - WealthWatcher Scadenze:
        icon: mdi-calendar-alert
        href: https://ww.example.net/dashboard/scadenziario
        widget:
          type: customapi
          url: https://ww.example.net/api/homepage/v1/deadlines?days=30
          refreshInterval: 300000
          headers:
            X-API-Key: "{{HOMEPAGE_VAR_WW_TOKEN}}"
          display: dynamic-list
          mappings:
            items: items
            name: name
            label: label

    - WealthWatcher Allocazione:
        icon: mdi-chart-donut
        href: https://ww.example.net/dashboard/mercati
        widget:
          type: customapi
          url: https://ww.example.net/api/homepage/v1/allocation
          refreshInterval: 300000
          headers:
            X-API-Key: "{{HOMEPAGE_VAR_WW_TOKEN}}"
          display: dynamic-list
          mappings:
            items: items
            name: name
            label: label
```

`refreshInterval: 300000` (5 minuti) è il valore raccomandato: i numeri sotto
il cofano vengono ricalcolati al massimo una volta al giorno (vedi §5), quindi
un refresh più frequente non porta dati più freschi, solo più richieste.

## 4. Riferimento endpoint

Tutti, tranne `/ping`, richiedono l'header di autenticazione (§2). Denaro
sempre in **euro** (float, 2 decimali), percentuali sempre in **scala 0–100**.

| Endpoint | Display consigliato | Contenuto |
|---|---|---|
| `GET /api/homepage/v1/ping` | `siteMonitor` | `{ status, app, version }` — pubblico |
| `GET /api/homepage/v1/summary` | `block` | Patrimonio netto, investito, liquidità, capitale investito, P/L (realizzato e latente), dividendi, commissioni, variazione (da ultima rilevazione, 1m/3m/6m/1y/tutto con CAGR), rischio (drawdown, volatilità, miglior/peggior mese), imposte stimate |
| `GET /api/homepage/v1/portfolios` | `dynamic-list` | Un elemento per portafoglio: valore, P/L %, MWRR % |
| `GET /api/homepage/v1/accounts` | `dynamic-list` | Un elemento per conto: istituto, saldo in EUR |
| `GET /api/homepage/v1/cashflow` | `block` | Entrate/uscite/risparmio del mese corrente, media 3 mesi, stato budget, autonomia finanziaria (mesi) |
| `GET /api/homepage/v1/goals` | `dynamic-list` | Un elemento per obiettivo: allocato/target, % completamento |
| `GET /api/homepage/v1/deadlines?days=30` | `dynamic-list` | Scadenze nei prossimi N giorni (1–365, default 30): bollo, rate, dividendi attesi, ecc. |
| `GET /api/homepage/v1/allocation` | `dynamic-list` | Composizione del portafoglio per classe di asset (Azioni/ETF/Obbligazioni/Crypto/Altro) |

Ogni risposta include anche `stale` (booleano — un prezzo o un cambio non era
disponibile, il numero è una stima parziale) e `asOf` (timestamp ISO della
risposta). `summary` include inoltre `snapshotDate` e `snapshotAgeHours`.

## 5. Freschezza dei dati

Gli endpoint leggono l'ultimo **snapshot patrimoniale** già calcolato
(`valuation_snapshots`), aggiornato al massimo una volta al giorno — non
ricalcolano tutto ad ogni chiamata, per non generare traffico verso i
provider di prezzi/cambi ad ogni refresh di Homepage. Per un aggiornamento
puntuale, usa il cron già presente nell'app:

```bash
npm run snapshot        # ricalcola lo snapshot patrimoniale di oggi
npm run market-refresh  # aggiorna prezzi/cambi
```

o semplicemente visita la dashboard: ogni visita aggiorna lo snapshot del
giorno se mancante.

## 6. Revocare l'accesso

Impostazioni → Accesso API · Homepage → **Revoca** sul token. L'effetto è
immediato: la prossima chiamata con quel token riceve `401`.
