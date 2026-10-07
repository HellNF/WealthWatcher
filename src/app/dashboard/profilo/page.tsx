import { requireUser } from '@/lib/dal'
import { getUserProfile } from '@/lib/userSettings'
import { estimateIncomeTax, ageFromBirthDate } from '@/lib/tax/income'
import ProfileForm from './ProfileForm'
import { Card, PageHeader, HeroShell, PAGE_SHELL } from '@/components/ui'
import Link from 'next/link'
import { AlertTriangle, Info } from 'lucide-react'

export const dynamic = 'force-dynamic'

const EMPLOYMENT_LABELS: Record<string, string> = {
  employee:                  'Lavoratore dipendente',
  pensioner:                 'Pensionato',
  self_employed_ordinario:   'Libero professionista — regime ordinario',
  self_employed_forfettario: 'Libero professionista — regime forfettario',
  none:                      'Altro / nessun reddito da lavoro',
}

function fmtEur(minor: number): string {
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', useGrouping: 'always', currency: 'EUR' })
}
function fmtPct(rate: number): string {
  return (rate * 100).toFixed(1) + '%'
}

export default async function ProfilePage() {
  const user    = await requireUser()
  const profile = getUserProfile(user.id)
  const tax     = estimateIncomeTax(profile)
  const age     = ageFromBirthDate(profile.birthDate)

  const displayName = profile.displayName ?? user.name ?? user.email ?? '—'
  const isItaly     = profile.taxResidency?.toUpperCase() === 'IT'

  const employment = EMPLOYMENT_LABELS[profile.employmentType ?? ''] ?? null
  const hasTax = tax.applicable && tax.totalMinor > 0

  return (
    <main className={`${PAGE_SHELL} space-y-8`}>
      <PageHeader
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Profilo personale' }]}
        title="Profilo personale"
        description="I tuoi dati anagrafici e fiscali: servono a stimare le imposte nella pagina Tasse."
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_26rem] 2xl:grid-cols-[minmax(0,1fr)_30rem] gap-x-8 2xl:gap-x-10 gap-y-8 items-start xl:items-stretch">

        {/* ── Modulo ───────────────────────────────────────────────────────── */}
        <Card className="order-2 xl:order-1 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-(--ink)">Modifica profilo</h2>
            <p className="text-xs text-(--muted) mt-0.5">
              I dati fiscali sono usati per stimare il carico tributario nella pagina{' '}
              <Link href="/dashboard/tasse" className="text-(--brand-text) hover:underline">Tasse</Link>.
            </p>
          </div>
          <ProfileForm profile={profile} />
        </Card>

        {/* ── Riepilogo: chi sei per l'app e cosa ne deriva ────────────────── */}
        <aside className="order-1 xl:order-2 min-w-0 flex flex-col gap-6 xl:[&>*:last-child]:flex-1">
          <HeroShell innerClassName="p-5 sm:p-6 gap-5">
            <div className="flex items-center gap-4">
              <span className="size-14 rounded-2xl bg-(--surface-2) ring-1 ring-(--border) flex items-center justify-center shrink-0 text-xl font-extrabold font-display text-(--ink)" aria-hidden>
                {displayName[0]?.toUpperCase() ?? '?'}
              </span>
              <div className="min-w-0">
                <p className="text-xl font-extrabold font-display tracking-[-0.02em] text-(--ink) truncate">{displayName}</p>
                <p className="text-sm text-(--muted) truncate">{user.email}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-(--border) pt-4 text-sm">
              <dt className="text-(--muted)">Età</dt>
              <dd className="text-right text-(--ink)">{age !== null ? `${age} anni` : 'non indicata'}</dd>
              <dt className="text-(--muted)">Attività</dt>
              <dd className="text-right text-(--ink)">{employment ?? 'non indicata'}</dd>
              <dt className="text-(--muted)">Residenza fiscale</dt>
              <dd className="text-right text-(--ink)">{profile.taxResidency?.toUpperCase() ?? 'non indicata'}</dd>
            </dl>
          </HeroShell>

          {hasTax && (
            <Card className="space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <h2 className="text-sm font-semibold text-(--ink)">Stima imposta sul reddito</h2>
                <Link href="/dashboard/tasse" className="text-xs text-(--brand-text) hover:underline shrink-0">
                  Dettaglio in Tasse
                </Link>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] text-(--ink)">{fmtEur(tax.totalMinor)}</p>
                <p className="text-xs text-(--muted)">
                  aliquota effettiva {fmtPct(tax.effectiveRate)} su un lordo di {fmtEur(profile.annualGrossIncomeMinor ?? 0)}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-(--border) pt-4 text-sm">
                <dt className="text-(--muted)">Imponibile</dt>
                <dd className="text-right font-mono tabular-nums text-(--ink)">{fmtEur(tax.taxableMinor)}</dd>
                {tax.irpefMinor > 0 && (<><dt className="text-(--muted)">IRPEF</dt><dd className="text-right font-mono tabular-nums text-(--ink)">{fmtEur(tax.irpefMinor)}</dd></>)}
                {tax.substituteMinor > 0 && (<><dt className="text-(--muted)">Imposta sostitutiva</dt><dd className="text-right font-mono tabular-nums text-(--ink)">{fmtEur(tax.substituteMinor)}</dd></>)}
                {tax.addizionaliMinor > 0 && (<><dt className="text-(--muted)">Addizionali (stima)</dt><dd className="text-right font-mono tabular-nums text-(--ink)">{fmtEur(tax.addizionaliMinor)}</dd></>)}
              </dl>
              {tax.brackets.length > 0 && (
                <div className="border-t border-(--border) pt-4 space-y-1.5">
                  <p className="text-xs font-medium text-(--muted)">Scaglioni IRPEF applicati</p>
                  {tax.brackets.map((b, i) => (
                    <div key={i} className="grid grid-cols-[3.5rem_1fr_auto] items-baseline gap-3 text-xs">
                      <span className="text-(--ink) font-mono tabular-nums">{fmtPct(b.rate)}</span>
                      <span className="text-(--muted)">su {fmtEur(b.taxedMinor)}</span>
                      <span className="text-(--ink) font-mono tabular-nums">{fmtEur(b.taxMinor)}</span>
                    </div>
                  ))}
                </div>
              )}
              {tax.note && (
                <p className="flex items-start gap-2 text-xs text-(--muted)">
                  <Info className="size-3.5 text-(--muted) shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden />
                  {tax.note}
                </p>
              )}
            </Card>
          )}

          {!tax.applicable && tax.note && (
            <Card className="flex items-start gap-3">
              <AlertTriangle className="size-4 text-(--warning-text) shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden />
              <p className="text-sm text-(--muted)">{tax.note}</p>
            </Card>
          )}

          {!isItaly && (
            <Card className="flex items-start gap-3">
              <AlertTriangle className="size-4 text-(--warning-text) shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-medium text-(--ink)">Residenza fiscale estera</p>
                <p className="text-xs text-(--muted)">
                  Con residenza fuori dall&apos;Italia, le imposte patrimoniali (bollo/IVAFE)
                  potrebbero non applicarsi. I calcoli nella pagina{' '}
                  <Link href="/dashboard/tasse" className="text-(--brand-text) hover:underline">Tasse</Link>
                  {' '}mostrano i valori indicativi basati sulle regole italiane.
                </p>
              </div>
            </Card>
          )}
        </aside>
      </div>
    </main>
  )
}
