# Product

## Register

product

## Users

Investitori privati autonomi, italiani, che gestiscono il proprio patrimonio senza consulenti
finanziari. Età 25-55, tech-savvy, abituati a strumenti come Revolut, Trading212 o Banca Mediolanum.
Accedono principalmente da desktop (laptop) ma si aspettano un'esperienza mobile dignitosa.

Contesto d'uso: durante una sessione di revisione del portafoglio (settimanale/mensile), o subito
dopo un'operazione di mercato (acquisto ETF, ricezione dividendo). Non è un pannello da monitorare
in tempo reale — è uno strumento di analisi, non di trading.

Il job principale: **capire dove si trova il loro patrimonio netto, come si sta evolvendo e se
le scelte di investimento stanno funzionando.**

## Product Purpose

WealthWatcher è un aggregatore patrimoniale self-hosted: raccoglie movimenti bancari, conti di
investimento e portafogli strumenti finanziari (ETF, azioni, crypto, obbligazioni) in un'unica
visione. Permette di tracciare il patrimonio netto nel tempo, analizzare le spese per categoria e
monitorare le performance degli investimenti con prezzi aggiornati.

Esistenza: nessuna app commerciale centralizza conti correnti + portafogli con privacy totale e
costo zero. WealthWatcher colma questo vuoto per chi non vuole condividere dati finanziari con terze
parti.

Successo = l'utente apre il dashboard e in 30 secondi capisce la sua situazione. Non deve
cliccare in giro per trovare i numeri che gli servono.

## Brand Personality

Affidabile · Chiaro · Moderno

Tono: diretto, senza sovra-semplificazioni. Parla da pari a pari con chi sa gestire un budget.
Non usa gergo finanziario oscuro ma neanche spiega l'ovvio. L'interfaccia comunica competenza
senza essere fredda o distante.

## Anti-references

- **Banche tradizionali italiane** (BancoPosta, UniCredit web): dense di testo, gerarchia caotica,
  colori istituzionali saturi, tutto sembra legacy. L'opposto di quello che vogliamo.
- **Bloomberg Terminal**: funzionale ma intimidatorio e senza respiro. Noi dobbiamo essere leggibili.
- **Generic SaaS dashboard templates** (Tremor, AdminLTE clones): impersonali, tutte uguali, nessuna
  personalità — si vede subito che è un template.
- **Crypto bro aesthetics**: dark-neon, gradient text, animazioni eccessive. Non siamo una piattaforma
  di trading speculativo.

## Design Principles

1. **Il numero risponde prima della domanda.** Le metriche chiave (patrimonio netto, saldo conto,
   P/L portafoglio) devono essere visibili senza scroll e senza interpretazione.
2. **Lo strumento sparisce nel task.** Componenti familiari, affordance standard, nessuna
   invenzione per il gusto del design. L'utente è qui per i propri dati, non per l'interfaccia.
3. **La densità è guadagnata.** Inizia aerato, aggiungi densità solo dove l'utente lo ha scelto
   (tabella transazioni, posizioni portafoglio). Non tutto deve essere una card.
4. **Il feedback è immediato.** Ogni azione — salvataggio categoria, refresh prezzi, import CSV —
   deve confermare il risultato senza ricaricare la pagina intera.
5. **Light e dark sono uguali.** Il toggle non è un extra. Entrambi i temi devono essere progettati
   con la stessa attenzione, non essere semplicemente l'inversione l'uno dell'altro.

## Accessibility & Inclusion

- WCAG 2.1 AA. Contrasto testo ≥4.5:1 (placeholder incluso). Elementi large ≥3:1.
- Ogni campo di form ha label visibile associata (non solo placeholder).
- Tabelle con `scope` e `caption` corretti.
- Focus visibile e keyboard-navigable in tutto il dashboard.
- `prefers-reduced-motion`: tutte le animazioni hanno un fallback istantaneo o crossfade.
- `prefers-color-scheme`: rispettato alla prima visita, sovrascrivibile con il toggle.
