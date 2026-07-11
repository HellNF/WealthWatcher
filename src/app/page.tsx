import Link from 'next/link'
import {
  LayoutDashboard, BarChart3, Wallet, TrendingUp,
  Landmark, Receipt, PiggyBank, Target, BookOpen,
  ArrowRight, FileText,
} from 'lucide-react'
import { getMessages } from '@/lib/messages'
import { getSession } from '@/lib/dal'
import ChatSection from '@/components/ChatSection'
import { WatcherMark } from '@/components/ui/WatcherMark'

export const dynamic = 'force-dynamic'

const FEATURES: { icon: React.ElementType; title: string; description: string }[] = [
  { icon: LayoutDashboard, title: 'Dashboard patrimonio',         description: 'Visione consolidata in tempo reale: conti, portafogli e altri beni. Grafico storico e variazione giornaliera.' },
  { icon: Wallet,          title: 'Conti correnti',               description: 'Import da Intesa Sanpaolo, Revolut, BBVA. Categorizzazione automatica, rettifica saldo e stima interessi.' },
  { icon: TrendingUp,      title: "Portafogli d'investimento",    description: 'P&L realizzato e latente, grafici allocazione, FIFO plusvalenze, prezzi da Yahoo Finance e CoinGecko.' },
  { icon: Receipt,         title: 'Report mensili e budget',      description: 'Report entrate/uscite per mese e categoria. Budget con soglie colore e confronto tra periodi.' },
  { icon: PiggyBank,       title: 'Ritenuta interessi',           description: 'Stima ritenuta 26% sugli interessi da giacenza per ogni conto remunerato. Aggregato annuo nella pagina Tasse.' },
  { icon: BookOpen,        title: 'Backfill storico prezzi',      description: 'Ricostruzione automatica dello storico prezzi da Yahoo Finance per P&L e grafici su orizzonti multi-anno.' },
]

const ROADMAP = [
  { status: 'active',   label: 'Importazione automatica via PSD2 / Open Banking' },
  { status: 'planned',  label: 'Supporto multi-utente e condivisione familiare' },
  { status: 'idea',     label: 'Obiettivi di risparmio con proiezione temporale' },
  { status: 'backlog',  label: 'Notifiche soglie patrimonio via email' },
  { status: 'backlog',  label: 'App mobile iOS / Android' },
]

function StatusDot({ status }: { status: string }) {
  if (status === 'active')  return <span className="mt-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
  if (status === 'planned') return <span className="mt-1 w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
  if (status === 'idea')    return <span className="mt-1 w-2 h-2 rounded-full bg-blue-400 shrink-0" />
  return                           <span className="mt-1 w-2 h-2 rounded-full bg-zinc-700 shrink-0" />
}

/* ── SVG area chart mockup ─────────────────────────────────────────────────── */
function ChartMockup() {
  const pts = [
    [0,110],[40,95],[90,100],[140,80],[190,70],[240,85],[290,60],[340,45],[390,55],[440,30],[500,15],[560,20],[620,8]
  ]
  const areaPath = `M${pts.map(([x,y])=>`${x},${y}`).join(' L')} L620,130 L0,130 Z`
  const linePath = `M${pts.map(([x,y])=>`${x},${y}`).join(' L')}`

  return (
    <div className="relative rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
      {/* top bar chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
        <span className="ml-4 text-xs text-zinc-500 font-mono">patrimonio_netto • 12 mesi</span>
      </div>
      {/* headline numbers */}
      <div className="px-5 pt-4 pb-2 flex items-end gap-3">
        <span className="font-mono text-2xl font-semibold text-white tracking-tight">€ 128.450</span>
        <span className="text-xs font-mono text-emerald-400 mb-0.5">▲ +4,3% questo mese</span>
      </div>
      {/* chart */}
      <svg viewBox="0 0 620 130" className="w-full" preserveAspectRatio="none" style={{height: 130}}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#areaGrad)" />
        <path d={linePath} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinejoin="round" />
        {/* last point dot */}
        <circle cx="620" cy="8" r="3" fill="#34d399" />
      </svg>
      {/* x-axis labels */}
      <div className="flex justify-between px-5 pb-3 mt-1">
        {['Lug','Ago','Set','Ott','Nov','Dic','Gen','Feb','Mar','Apr','Mag','Giu','Lug'].map((m, i) => (
          <span key={i} className="text-[10px] font-mono text-zinc-600">{m}</span>
        ))}
      </div>
    </div>
  )
}

/* ── Mini bar chart mockup (bento fiscale) ─────────────────────────────────── */
function FiscalMockup() {
  const bars = [
    { label: 'Capital gain', val: 72, color: 'bg-emerald-500' },
    { label: 'Bollo/IVAFE',  val: 45, color: 'bg-zinc-600' },
    { label: 'Ritenute',     val: 28, color: 'bg-yellow-500' },
  ]
  return (
    <div className="mt-5 space-y-2.5">
      {bars.map(b => (
        <div key={b.label}>
          <div className="flex justify-between mb-1">
            <span className="text-xs font-mono text-zinc-500">{b.label}</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${b.color}`} style={{ width: `${b.val}%` }} />
          </div>
        </div>
      ))}
      <div className="pt-3 border-t border-zinc-800 font-mono text-xs flex justify-between">
        <span className="text-zinc-500">TOTALE STIMATO 2026</span>
        <span className="text-white">31 €</span>
      </div>
      <div className="font-mono text-xs flex justify-between">
        <span className="text-zinc-500">TASSE LATENTI</span>
        <span className="text-red-400">-99,00 €</span>
      </div>
    </div>
  )
}

export default async function Home() {
  const messages = getMessages()
  const session  = await getSession()
  const isAdmin  = session?.role === 'admin'

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-300 font-sans">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href={session?.uid ? '/dashboard' : '/'} className="flex items-center gap-2 group hover:opacity-80 transition-opacity">
            <WatcherMark size="md" className="text-emerald-400" />
            <span className="font-semibold text-white tracking-tight">WealthWatcher</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/dashboard/tasse" className="text-sm text-zinc-400 hover:text-white transition-colors hidden sm:block">
              Gestione tasse
            </Link>
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 h-8 pl-4 pr-1.5 rounded-full bg-white text-zinc-950 text-sm font-semibold hover:bg-zinc-100 transition-all duration-200 [transition-timing-function:var(--ease-spring)] active:scale-[0.97]"
            >
              Dashboard
              <span className="flex items-center justify-center size-5 rounded-full bg-zinc-950/10 transition-transform duration-200 [transition-timing-function:var(--ease-spring)] group-hover:translate-x-0.5">
                <ArrowRight className="size-3" strokeWidth={2} />
              </span>
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">

        {/* ── HERO ───────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* glow ambientali — fixed, non interattivi, nessun repaint su scroll */}
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
            <div className="absolute -top-32 left-1/4 w-[32rem] h-[32rem] rounded-full bg-emerald-500/10 blur-[120px]" />
            <div className="absolute top-10 right-0 w-[24rem] h-[24rem] rounded-full bg-emerald-400/[0.07] blur-[100px]" />
          </div>

          <div className="max-w-6xl mx-auto px-6 pt-20 pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 items-center">

            {/* left: copy */}
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-mono text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                sistema operativo · aggiornato luglio 2026
              </div>

              <h1 className="text-5xl sm:text-6xl font-bold tracking-tighter text-white leading-[1.05]">
                Il tuo patrimonio,<br />
                <span className="text-zinc-500">sempre sotto controllo.</span>
              </h1>

              <p className="text-base text-zinc-400 leading-relaxed max-w-lg">
                WealthWatcher consolida conti correnti, portafogli d&apos;investimento e altri beni
                in un&apos;unica vista. Motore fiscale italiano completo: dalla tassazione capital gain
                alla stima IRPEF, passando per bollo, IVAFE e zainetto minusvalenze.
              </p>

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/dashboard"
                  className="group inline-flex items-center gap-2.5 h-11 pl-6 pr-2 rounded-full bg-white text-zinc-950 font-semibold hover:bg-zinc-100 transition-all duration-200 [transition-timing-function:var(--ease-spring)] active:scale-[0.98] text-sm"
                >
                  Vai alla dashboard
                  <span className="flex items-center justify-center size-7 rounded-full bg-zinc-950/10 transition-transform duration-200 [transition-timing-function:var(--ease-spring)] group-hover:translate-x-0.5">
                    <ArrowRight className="size-3.5" strokeWidth={2} />
                  </span>
                </Link>
                <Link
                  href="/dashboard/tasse"
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-full border border-zinc-800 text-zinc-300 font-semibold hover:border-zinc-600 hover:text-white transition-all duration-200 [transition-timing-function:var(--ease-spring)] active:scale-[0.98] text-sm"
                >
                  <Landmark className="size-4" strokeWidth={1.75} /> Gestione tasse
                </Link>
              </div>

              {/* stat row */}
              <div className="flex items-center gap-6 pt-2 border-t border-zinc-800/60">
                <div>
                  <div className="font-mono text-lg font-semibold text-white">11</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Funzionalità</div>
                </div>
                <div className="w-px h-8 bg-zinc-800" />
                <div>
                  <div className="font-mono text-lg font-semibold text-white">26%</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Aliquota capital gain</div>
                </div>
                <div className="w-px h-8 bg-zinc-800" />
                <div>
                  <div className="font-mono text-lg font-semibold text-white">FIFO</div>
                  <div className="text-xs text-zinc-500 mt-0.5">Metodo calcolo fiscale</div>
                </div>
              </div>
            </div>

            {/* right: chart mockup */}
            <div className="hidden lg:block">
              <ChartMockup />
            </div>
          </div>
          </div>
        </section>

        {/* ── BENTO BOX ──────────────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 pb-28">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* tile 1 — Hub fiscale (large) */}
            <div className="md:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 hover:border-zinc-700 hover:-translate-y-1 transition-all duration-300 [transition-timing-function:var(--ease-spring)]">
              <div className="flex items-start gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <Landmark className="size-4 text-emerald-400" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Hub fiscale italiano</h3>
                  <p className="text-sm text-zinc-500 mt-0.5 leading-relaxed">
                    Plus/minusvalenze FIFO, zainetto fiscale con scadenza 4 anni, bollo, IVAFE e simulatore di vendita — tutto per anno selezionabile.
                  </p>
                </div>
              </div>
              <FiscalMockup />
            </div>

            {/* tile 2 — Istituzioni */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 hover:border-zinc-700 hover:-translate-y-1 transition-all duration-300 [transition-timing-function:var(--ease-spring)] flex flex-col justify-between">
              <div>
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center mb-4">
                  <BarChart3 className="size-4 text-emerald-400" strokeWidth={1.75} />
                </div>
                <h3 className="text-white font-semibold mb-1">Istituzioni supportate</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Intesa Sanpaolo, Revolut, BBVA, Directa SIM. Prezzi da Yahoo Finance e CoinGecko.
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                {['ISP','REV','BBVA','DIR','YF','CG'].map(abbr => (
                  <div key={abbr} className="w-9 h-9 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-mono text-zinc-400">
                    {abbr}
                  </div>
                ))}
              </div>
            </div>

            {/* tile 3 — IRPEF */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 hover:border-zinc-700 hover:-translate-y-1 transition-all duration-300 [transition-timing-function:var(--ease-spring)]">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center mb-4">
                <FileText className="size-4 text-emerald-400" strokeWidth={1.75} />
              </div>
              <h3 className="text-white font-semibold mb-1">Profilo fiscale e IRPEF</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                Residenza fiscale, tipo di impiego, reddito lordo. Stima IRPEF con scaglioni 2025. Supporto dipendenti, pensionati, autonomi e forfettari.
              </p>
              <div className="mt-5 font-mono text-xs space-y-1.5 text-zinc-500">
                <div className="flex justify-between"><span>0 – 28.000 €</span><span className="text-zinc-400">23%</span></div>
                <div className="flex justify-between"><span>28.000 – 50.000 €</span><span className="text-zinc-400">35%</span></div>
                <div className="flex justify-between"><span>oltre 50.000 €</span><span className="text-zinc-400">43%</span></div>
              </div>
            </div>

            {/* tile 4 — Report */}
            <div className="md:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 hover:border-zinc-700 hover:-translate-y-1 transition-all duration-300 [transition-timing-function:var(--ease-spring)]">
              <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center mb-4">
                <Receipt className="size-4 text-emerald-400" strokeWidth={1.75} />
              </div>
              <h3 className="text-white font-semibold mb-1">Report mensili e statistiche avanzate</h3>
              <p className="text-sm text-zinc-500 leading-relaxed mb-5">
                Report entrate/uscite per mese e categoria. Proiezione cashflow, distribuzione patrimonio, DCA recommender, tax-loss harvesting e previsione costi fiscali annui.
              </p>
              {/* mini sparkline bars */}
              <div className="flex items-end gap-1.5 h-12">
                {[40,65,48,72,55,80,62,90,70,85,95,88].map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm bg-emerald-500/20 border border-emerald-500/30" style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {['L','A','S','O','N','D','G','F','M','A','M','G'].map((m, i) => (
                  <span key={i} className="text-[9px] font-mono text-zinc-700">{m}</span>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* ── FEATURE GRID ───────────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 pb-28">
          <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-8">Tutte le aree coperte</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-7">
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-start gap-3.5 group">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 group-hover:border-zinc-700 transition-colors">
                  <f.icon className="size-4 text-zinc-400 group-hover:text-emerald-400 transition-colors" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{f.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── COMMAND CENTER ─────────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 pb-28">
          <div className="mb-8 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-mono text-zinc-300 uppercase tracking-widest">Dev Feed &amp; Roadmap</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">

            {/* roadmap */}
            <div className="space-y-5">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Cosa stiamo costruendo</p>
              <ul className="space-y-3">
                {ROADMAP.map(item => (
                  <li key={item.label} className="flex items-start gap-2.5">
                    <StatusDot status={item.status} />
                    <span className={`text-sm leading-snug ${item.status === 'backlog' ? 'text-zinc-600' : 'text-zinc-300'}`}>
                      {item.label}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="pt-4 space-y-1.5 border-t border-zinc-800">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> In corso
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" /> Pianificato
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Idea
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="w-2 h-2 rounded-full bg-zinc-700" /> Backlog
                </div>
              </div>
            </div>

            {/* terminal chat */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl flex flex-col h-[520px]">
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/60">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/40 border border-red-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40 border border-yellow-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/40 border border-emerald-500/60" />
                <span className="ml-3 text-xs font-mono text-zinc-500">discussione_e_proposte.sh --live</span>
                <span className="ml-auto text-xs font-mono text-zinc-600">inserisci proposte · segnala bug · discuti idee</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatSection initialMessages={messages} isAdmin={isAdmin} />
              </div>
            </div>

          </div>
        </section>

        {/* ── FINAL CTA ──────────────────────────────────────────────────────── */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 px-8 py-16 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              Pronto a iniziare?
            </h2>
            <p className="text-zinc-400 max-w-lg mx-auto leading-relaxed mb-8">
              Aggiungi le tue istituzioni, importa i movimenti e ottieni subito una visione
              completa del tuo patrimonio e del tuo carico fiscale.
            </p>
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2.5 h-12 pl-8 pr-2.5 rounded-full bg-white text-zinc-950 font-semibold hover:bg-zinc-100 transition-all duration-200 [transition-timing-function:var(--ease-spring)] active:scale-[0.98]"
            >
              Entra nella dashboard
              <span className="flex items-center justify-center size-8 rounded-full bg-zinc-950/10 transition-transform duration-200 [transition-timing-function:var(--ease-spring)] group-hover:translate-x-0.5">
                <ArrowRight className="size-4" strokeWidth={2} />
              </span>
            </Link>
          </div>
        </section>

      </main>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/60 px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4 text-xs text-zinc-600">
          <span className="inline-flex items-center gap-2 font-mono">
            <WatcherMark size={14} className="text-zinc-600" />
            © 2026 WealthWatcher
          </span>
          <div className="flex items-center gap-5">
            <Link href="/dashboard"          className="hover:text-zinc-300 transition-colors">Dashboard</Link>
            <Link href="/dashboard/tasse"    className="hover:text-zinc-300 transition-colors">Gestione tasse</Link>
            <Link href="/dashboard/profilo"  className="hover:text-zinc-300 transition-colors">Profilo fiscale</Link>
            <Link href="/dashboard/settings" className="hover:text-zinc-300 transition-colors">Impostazioni</Link>
            <Link href="/privacy"            className="hover:text-zinc-300 transition-colors">Privacy</Link>
            <Link href="/terms"              className="hover:text-zinc-300 transition-colors">Termini</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
