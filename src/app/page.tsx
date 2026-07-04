import Link from 'next/link'
import {
  LayoutDashboard, BarChart3, Wallet, TrendingUp,
  Landmark, Receipt, PiggyBank, Target, User,
  ArrowRight, Sparkles, ShieldCheck, BookOpen,
} from 'lucide-react'
import { getMessages } from '@/lib/messages'
import ChatSection from '@/components/ChatSection'

export const dynamic = 'force-dynamic'

// ── Novità — le ultime feature rilasciate (aggiornare ad ogni milestone) ──────

const NEWS: { label: string; description: string }[] = [
  {
    label: 'Profilo personale e stima IRPEF',
    description:
      "Inserisci residenza fiscale, tipo di impiego e reddito lordo: l'app calcola una stima dell'imposta sul reddito con scaglioni IRPEF 2025 e supporto al regime forfettario.",
  },
  {
    label: 'Hub fiscale /tasse',
    description:
      'Una pagina dedicata centralizza plus/minusvalenze realizzate, zainetto fiscale, tasse latenti, bollo/IVAFE, ritenuta interessi e simulatore di vendita FIFO — tutto per anno selezionabile.',
  },
  {
    label: 'Modifica operazioni di investimento',
    description:
      'Ogni operazione nel portafoglio (acquisto, vendita, dividendo) può essere modificata inline direttamente dalla lista, senza dover cancellare e ricreare.',
  },
  {
    label: 'Filtro data e paginazione movimenti',
    description:
      'I movimenti del conto corrente ora supportano filtri per data (da/a) e la possibilità di caricare tutti i movimenti oltre il limite predefinito di 50.',
  },
  {
    label: 'Provider Directa SIM e categoria Tasse',
    description:
      'Directa SIM aggiunta alla lista broker selezionabili. Nuova categoria "Tasse" disponibile per la classificazione delle uscite fiscali.',
  },
]

// ── Funzionalità principali ───────────────────────────────────────────────────

const FEATURES: {
  icon: React.ElementType
  title: string
  description: string
}[] = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard patrimonio',
    description:
      "Visione consolidata del patrimonio netto in tempo reale: conti correnti, portafogli d’investimento e altri beni. Grafico storico e variazione giornaliera.",
  },
  {
    icon: Wallet,
    title: 'Conti correnti',
    description:
      'Import movimenti da Intesa Sanpaolo, Revolut e BBVA. Categorizzazione automatica tramite regole su parole chiave, rettifica saldo manuale e stima interessi sulla giacenza.',
  },
  {
    icon: TrendingUp,
    title: "Portafogli d'investimento",
    description:
      'Tracciamento posizioni con P&L realizzato e latente, grafici di allocazione e andamento prezzi. Metodo FIFO per le plusvalenze, aggiornamento prezzi da Yahoo Finance e CoinGecko.',
  },
  {
    icon: Landmark,
    title: 'Fiscalità italiana completa',
    description:
      'Motore fiscale italiano: aliquote 26%/12,5% (titoli White List), asimmetria ETF (reddito capitale vs. diverso), franchigia cripto €2.000, zainetto minusvalenze con scadenza 4 anni, bollo e IVAFE.',
  },
  {
    icon: Receipt,
    title: 'Report mensili e budget',
    description:
      'Report entrate/uscite per mese e categoria. Budget mensili per categoria con soglie colore (verde/arancio/rosso). Confronto tra periodi.',
  },
  {
    icon: BarChart3,
    title: 'Statistiche avanzate',
    description:
      'Proiezione cashflow, distribuzione patrimonio, DCA recommender, tax-loss harvesting e previsione costi fiscali annui. Simulatore di vendita FIFO con anteprima impatto fiscale.',
  },
  {
    icon: PiggyBank,
    title: 'Ritenuta interessi',
    description:
      'Stima della ritenuta fiscale del 26% sugli interessi da giacenza per ogni conto remunerato. Aggregato annuo nella pagina Tasse.',
  },
  {
    icon: Target,
    title: 'Budget e obiettivi',
    description:
      'Budget mensili per categoria con barra di avanzamento. Avvisi automatici al raggiungimento delle soglie configurabili.',
  },
  {
    icon: User,
    title: 'Profilo fiscale personale',
    description:
      'Residenza fiscale, tipo di impiego e reddito lordo per calcolare la stima IRPEF con scaglioni 2025. Supporto a dipendenti, pensionati, autonomi ordinari e forfettari.',
  },
  {
    icon: BookOpen,
    title: 'Backfill storico prezzi',
    description:
      'Ricostruzione automatica dello storico prezzi giornalieri da Yahoo Finance per calcolare P&L e grafici su orizzonti multi-anno.',
  },
  {
    icon: ShieldCheck,
    title: 'Importazione KID',
    description:
      'Carica il documento KID di un ETF/fondo: estrazione automatica via AI (OpenAI) di TER, SRI e costi. Revisione manuale prima del salvataggio.',
  },
]

export default function Home() {
  const messages = getMessages()

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-emerald-500 flex items-center justify-center text-sm font-bold text-zinc-950">
              W
            </div>
            <span className="font-semibold text-zinc-100">WealthWatcher</span>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-500 text-zinc-950 text-sm font-semibold hover:bg-emerald-400 transition-colors"
          >
            Apri la dashboard
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <div className="flex-1 max-w-6xl mx-auto w-full px-6 pb-8 space-y-20">

        <div className="py-12 space-y-20">

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section className="text-center space-y-6 max-w-3xl mx-auto pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium">
            <Sparkles className="size-3.5" />
            Gestione patrimoniale personale
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight text-zinc-50">
            Il tuo patrimonio, sempre{' '}
            <span className="text-emerald-400">sotto controllo</span>
          </h1>
          <p className="text-lg text-zinc-400 leading-relaxed">
            WealthWatcher consolida conti correnti, portafogli d'investimento e altri beni
            in un'unica vista. Motore fiscale italiano completo: dalla tassazione capital gain
            alla stima IRPEF, passando per bollo, IVAFE e zainetto minusvalenze.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition-colors"
            >
              Vai alla dashboard
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/dashboard/tasse"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-xl border border-zinc-700 text-zinc-200 font-semibold hover:bg-zinc-900 transition-colors"
            >
              <Landmark className="size-4" />
              Gestione tasse
            </Link>
          </div>
        </section>

        {/* ── Novità ─────────────────────────────────────────────────────────── */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <Sparkles className="size-5 text-emerald-400 shrink-0" />
            <h2 className="text-xl font-bold text-zinc-50">Novità</h2>
            <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              ultime release
            </span>
          </div>

          <div className="space-y-3">
            {NEWS.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-4 hover:border-zinc-700 transition-colors"
              >
                <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-100">{item.label}</p>
                  <p className="text-sm text-zinc-400 mt-0.5 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Funzionalità ───────────────────────────────────────────────────── */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-zinc-50">Funzionalità</h2>
            <p className="text-sm text-zinc-400 mt-1">Tutte le aree coperte dall'applicazione.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3 hover:border-zinc-700 transition-colors"
              >
                <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center">
                  <f.icon className="size-5 text-emerald-400" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{f.title}</p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA finale ─────────────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-8 py-10 text-center space-y-4">
          <h2 className="text-2xl font-bold text-zinc-50">Pronto a iniziare?</h2>
          <p className="text-zinc-400 max-w-lg mx-auto">
            Aggiungi le tue istituzioni, importa i movimenti e ottieni subito una visione
            completa del tuo patrimonio e del tuo carico fiscale.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 h-11 px-8 rounded-xl bg-emerald-500 text-zinc-950 font-semibold hover:bg-emerald-400 transition-colors"
          >
            Entra nella dashboard
            <ArrowRight className="size-4" />
          </Link>
        </section>

        </div>

        {/* ── Chat ────────────────────────────────────────────────────────────── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xl font-bold text-zinc-50">Discussione &amp; Proposte</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
            {/* chat */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden h-[560px] flex flex-col">
              <ChatSection initialMessages={messages} />
            </div>
            {/* colonna laterale */}
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
                <p className="text-sm font-semibold text-zinc-100">A cosa serve questa sezione?</p>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Qui puoi lasciare proposte di nuove funzionalità, segnalare bug o discutere
                  idee per il progetto. Ogni messaggio è visibile a tutti gli utenti.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
                <p className="text-sm font-semibold text-zinc-100">Cosa stiamo costruendo</p>
                <ul className="space-y-2 text-sm text-zinc-400">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    Importazione automatica estratti conto via PSD2/Open Banking
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    Supporto multi-utente e condivisione patrimonio familiare
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    Obiettivi di risparmio con proiezione temporale
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                    <span className="text-zinc-500">Notifiche soglie patrimonio via email</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                    <span className="text-zinc-500">App mobile (iOS/Android)</span>
                  </li>
                </ul>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-2">
                <p className="text-sm font-semibold text-zinc-100">Link rapidi</p>
                <div className="flex flex-col gap-1.5">
                  <Link href="/dashboard" className="text-sm text-emerald-400 hover:underline">→ Dashboard</Link>
                  <Link href="/dashboard/tasse" className="text-sm text-emerald-400 hover:underline">→ Gestione tasse</Link>
                  <Link href="/dashboard/profilo" className="text-sm text-emerald-400 hover:underline">→ Profilo fiscale</Link>
                  <Link href="/dashboard/settings" className="text-sm text-emerald-400 hover:underline">→ Impostazioni</Link>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap text-xs text-zinc-500">
          <span>WealthWatcher — gestione patrimoniale personale</span>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="hover:text-zinc-300 transition-colors">Dashboard</Link>
            <Link href="/dashboard/tasse" className="hover:text-zinc-300 transition-colors">Tasse</Link>
            <Link href="/dashboard/profilo" className="hover:text-zinc-300 transition-colors">Profilo</Link>
            <Link href="/dashboard/settings" className="hover:text-zinc-300 transition-colors">Impostazioni</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
