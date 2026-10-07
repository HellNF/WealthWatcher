# Design

## Color

**Strategy: Restrained** — superfici neutre a tinta brand, accento emerald per azioni primarie
e guadagni, vocabolario semantico per gli stati.

**Filosofia "verde = soldi"**: emerald è sia il brand color che il colore dei guadagni (P/L
positivo). Non è una collisione — è intenzionale. Il contesto (bottone primario vs delta di
portafoglio) disambigua.

### Dove usare verde e rosso

Verde e rosso sono un segnale, non una decorazione: se compaiono ovunque smettono di dire qualcosa.
Si usano **solo** per:

1. **Il segno di un risultato**: P/L, saldo netto, variazione rispetto a una base (delta).
2. **Uno stato**: errore, conferma di un'azione distruttiva, liquidità critica, esito positivo.
3. **Brand in azione**: bottone primario, voce di navigazione attiva, link.

Restano neutri (`--ink` / `--muted`): le uscite in quanto tali, le imposte, i titoli e le frasi di
verdetto, le barre dei grafici di spesa, avatar e icone decorative, i pulsanti secondari
("Aggiungi"), il pulsante "Elimina" a riposo (diventa rosso in hover e nella conferma), le etichette
di severità non critiche. Un insight colora solo il glifo; solo "critico" ha fondo e badge rossi.

### Token semantici

Tutte le variabili sono definite in `src/app/globals.css` con OKLCH.

| Token | Light | Dark | Ruolo |
|-------|-------|------|-------|
| `--bg` | `oklch(0.98 0 0)` | `oklch(0.13 0.006 160)` | Sfondo pagina |
| `--surface` | `oklch(1 0 0)` | `oklch(0.17 0.007 160)` | Card, pannelli |
| `--surface-2` | `oklch(0.96 0.003 160)` | `oklch(0.21 0.008 160)` | Input, toolbar, sidebar |
| `--border` | `oklch(0.88 0.005 160)` | `oklch(0.28 0.01 160)` | Bordi, divisori |
| `--ink` | `oklch(0.13 0 0)` | `oklch(0.97 0 0)` | Testo primario |
| `--muted` | `oklch(0.45 0.01 160)` | `oklch(0.72 0.01 160)` | Testo secondario |
| `--faint` | `oklch(0.55 0.008 160)` | `oklch(0.60 0.01 160)` | Testo terziario, placeholder (≥4.5:1 su surface) |
| `--brand` | `oklch(0.7 0.17 162)` | `oklch(0.72 0.18 162)` | Emerald — primary, guadagni |
| `--brand-fg` | `oklch(0.13 0 0)` | `oklch(0.13 0 0)` | Testo su sfondi brand |
| `--brand-subtle` | `oklch(0.94 0.04 162)` | `oklch(0.20 0.04 162)` | Sfondo badge gain, tag |
| `--danger` | `oklch(0.60 0.22 27)` | `oklch(0.65 0.22 27)` | Perdite, errori |
| `--danger-subtle` | `oklch(0.95 0.04 27)` | `oklch(0.22 0.05 27)` | Sfondo badge danger |
| `--warning` | `oklch(0.72 0.17 85)` | `oklch(0.75 0.16 85)` | Prezzi stale, avvisi |
| `--warning-subtle` | `oklch(0.95 0.05 85)` | `oklch(0.21 0.05 85)` | Sfondo badge warning |
| `--info` | `oklch(0.65 0.15 240)` | `oklch(0.70 0.14 240)` | Dividendi, info neutri |
| `--info-subtle` | `oklch(0.94 0.04 240)` | `oklch(0.20 0.04 240)` | Sfondo badge info |
| `--ring` | `oklch(0.7 0.17 162 / 0.5)` | `oklch(0.72 0.18 162 / 0.5)` | Focus ring |

**Ombre** (solo light, dark usa step di superficie + border):
- `--shadow-sm`: `0 1px 3px oklch(0 0 0 / 0.06), 0 1px 2px oklch(0 0 0 / 0.04)`
- `--shadow-md`: `0 4px 12px oklch(0 0 0 / 0.08), 0 2px 4px oklch(0 0 0 / 0.04)`
- `--shadow-lg`: `0 8px 24px oklch(0 0 0 / 0.10), 0 4px 8px oklch(0 0 0 / 0.06)`

## Typography

**Famiglie**: Geist Sans (tutto il UI) + Geist Mono (cifre finanziarie, codice, ISIN).
In più **Bricolage Grotesque** (`font-display`, peso 800) solo per i titoli di pagina (`PageHeader`)
e per le cifre e il verdetto delle hero: mai in etichette, tabelle, card normali o bottoni.
Una sola famiglia sans è corretta per un product dashboard — tighter scale ratio, no pairing.

**Scala (rem, fixed)**:
- `--text-xs`: 0.6875rem / 1rem — etichette, badge, metadata
- `--text-sm`: 0.8125rem / 1.25rem — label form, caption
- `--text-base`: 0.9375rem / 1.5rem — body, valore default componenti
- `--text-lg`: 1.0625rem / 1.5rem — heading sezione
- `--text-xl`: 1.25rem / 1.75rem — heading pagina
- `--text-2xl`: 1.5rem / 2rem — metrica primaria (net worth)
- `--text-3xl`: 1.875rem / 2.25rem — metrica hero

**Regole**:
- `font-mono tabular-nums` su tutte le cifre (prezzi, saldi, P/L, quantità).
- Heading max `text-3xl` (30px) — nessun display heading nel product UI.
- Line length: `max-w-[65ch]` su corpo testuale (descrizioni, messaggi vuoti).
- `text-wrap: balance` su h1–h3 nei titoli di pagina.

## Components

### Hero (HeroShell, Eyebrow, HeroLink)
Ogni pagina apre con una sola sezione hero che contiene la risposta principale (numeri chiave e,
se serve, il verdetto): l'utente non deve scorrere per trovarla, sotto ci sono gli approfondimenti.
- `HeroShell`: doppia cornice — guscio `rounded-[1.75rem] p-1.5 bg-(--bezel)` con filetto, nucleo
  `rounded-[calc(1.75rem-0.375rem)] bg-(--surface)` con `--shadow-md`, `--highlight` e luce
  ambientale neutra (`--hero-glow`, mai colorata). È l'unico contenitore con questo trattamento:
  le card normali restano `Card`.
- `Eyebrow`: pillola `text-[10px] uppercase tracking-[0.18em]` sopra il dato principale. Una per
  hero, mai sopra le sezioni interne.
- `HeroLink`: link-azione a pillola con la freccia annidata nel proprio cerchio; in hover il
  cerchio si sposta in diagonale (`ease-drawer`, 500ms), `active:scale-[0.98]`.
- Ingresso: classe `hero-enter`, un solo fade-up (12px, blur 6px, 600–700ms) via `@starting-style`;
  con `prefers-reduced-motion` resta solo l'opacità. Nessun'altra animazione d'ingresso in pagina.
- Cifre dell'hero e frase di verdetto in **Bricolage Grotesque** (`font-display font-extrabold
  tabular-nums`, da `text-3xl` a `text-7xl`, tracking −0.02/−0.03em): il carattere pieno è ciò che
  rende l'hero riconoscibile. Le cifre tabulari sono verificate (larghezza costante).

### PageHeader
Testata unica di ogni pagina dashboard: breadcrumb agganciato al titolo, `h1` in `text-2xl
font-semibold tracking-tight`, descrizione opzionale `--muted max-w-[65ch]`, `meta` (badge) accanto
al titolo e `actions` a destra. Nessuna pagina monta `Breadcrumb` + `h1` a mano.

### Importi
Ogni importo mostrato passa da `formatMoney(minor, currency)` (`src/lib/money.ts`) o da un
`toLocaleString('it-IT', { style: 'currency', useGrouping: 'always' })`: separatore delle migliaia
sempre presente, mai `fromMinor` (formato di storage) in UI.

### Button
Varianti: `primary` (bg brand, ink on brand), `secondary` (border, muted bg), `ghost` (no border,
hover bg subtle), `danger` (red bg/border on hover). Size: `sm`, `md` (default), `lg`.
Stati: default → hover (opacity 0.9 + slight translate-y) → focus (ring) → active → disabled
(opacity 0.5, cursor-not-allowed) → loading (spinner sostituisce label, stessa dimensione).

### Card
`rounded-2xl border border-(--border) bg-(--surface)`. In light: `shadow-(--shadow-sm)`.
In dark: nessuna ombra, bordo esplicito. `p-5` default. Mai nested cards.

### Input / Select / Textarea
`bg-(--surface-2) border border-(--border) rounded-lg text-(--ink) placeholder:text-(--faint)`.
Focus: `ring-2 ring-(--ring) border-(--brand)`. Error: `border-(--danger) ring-(--danger)/30`.

### Badge
Pill arrotondato (`rounded-full`). Varianti: `success`, `danger`, `warning`, `info`, `neutral`.
Usa `--*-subtle` come bg e colore token come fg. Anche: `gain`/`loss` per P/L.

### Stat
Componente per metriche finanziarie: label sopra in `--muted`, valore in `font-mono tabular-nums`,
delta opzionale con badge gain/loss. Dimensioni: `sm` (dashboard dettaglio), `md` (default),
`lg` (net worth hero).

### EmptyState
`flex-col items-center gap-4 py-16 px-8`: icona lucide in `--faint`, titolo `--ink`,
descrizione `--muted max-w-[45ch] text-center`, azione opzionale Button secondary.

### Skeleton
`animate-pulse rounded-md bg-(--surface-2)`. Varianti per testo (`h-4 w-32`), metrica
(`h-8 w-48`), riga tabella (`h-10 w-full`), avatar (`size-8 rounded-full`).

### Toast
Stack in basso a destra (desktop) / in alto (mobile). Auto-dismiss 4s. Varianti: success
(brand border), error (danger border), info (info border). Animazione: slide-up + fade-in
(150ms), fade-out (100ms). Reduced-motion: solo fade.

### Sidebar Nav
Voce: `flex items-center gap-3 px-3 py-2 rounded-lg text-sm`. Stato normale: `text-(--muted)`
hover: `bg-(--surface-2) text-(--ink)`. Attiva: `bg-(--brand-subtle) text-(--brand) font-medium`.
Icona lucide 18px. Label a destra.

## Layout

**App shell**: sidebar 240px fissa desktop, collassabile su mobile (drawer overlay).
Content area: padding `p-6` (desktop), `p-4` (mobile). Max-width del contenuto: `max-w-6xl`
(più largo del vecchio `max-w-5xl` per le tabelle).

**Z-index semantico**:
- `10` — sticky header / toolbar locali
- `20` — dropdown, popover
- `30` — sidebar mobile overlay
- `40` — dialog backdrop
- `50` — dialog
- `60` — toast
- `70` — tooltip

**Grid rules**: `grid-cols-[repeat(auto-fit,minmax(200px,1fr))]` per stat card. Flexbox per
toolbar e header interni. Mai Grid dove Flex basta.

## Motion

Libreria: `motion` (Framer Motion v11+). Uso parsimonioso — solo dove comunica stato.
- **Count-up net worth**: da 0 al valore reale in 600ms, ease-out-quart, solo al mount.
- **Toast**: slide-up 8px + opacity 0→1 in 150ms; slide-down + opacity 1→0 in 100ms.
- **Sidebar mobile**: slide-in da sinistra 240px in 200ms ease-out-quart.
- **Skeleton → contenuto**: crossfade opacity 200ms.
- `@media (prefers-reduced-motion: reduce)`: tutti → `duration-0` (istantanei).

## Spacing

Scala standard Tailwind (4px base). Ritmo: variare tra 2/3/4/6/8/12 — non usare sempre lo
stesso. Card gap: `gap-4` o `gap-6`. Sezioni di pagina: `space-y-6` o `space-y-8`.

## Iconography

Lucide React — `size-4` (16px) inline, `size-5` (20px) in bottoni, `size-6` (24px) in nav,
`size-8` (32px) in empty state. Stroke width 1.75 (default lucide). Mai emoji come icone funzionali.

## Border Radius

- `rounded-md` — input, select, badge
- `rounded-lg` — bottoni, tag, sidebar voci
- `rounded-xl` — card compatte
- `rounded-2xl` — card primarie, modal
- `rounded-full` — badge pill, avatar, brand mark
