import { requireUser } from '@/lib/dal'
import { getUserProfile } from '@/lib/userSettings'
import { estimateIncomeTax, ageFromBirthDate } from '@/lib/tax/income'
import { fromMinor } from '@/lib/money'
import ProfileForm from './ProfileForm'
import { Breadcrumb, Card, Stat } from '@/components/ui'
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
  return (minor / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
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

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Profilo personale' },
      ]} />

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="size-14 rounded-2xl bg-[--brand-subtle] flex items-center justify-center shrink-0">
          <span className="text-xl font-bold text-[--brand-text]">
            {displayName[0]?.toUpperCase() ?? '?'}
          </span>
        </div>
        <div>
          <p className="text-lg font-semibold text-[--ink]">{displayName}</p>
          <p className="text-sm text-[--muted]">{user.email}</p>
          {age !== null && (
            <p className="text-xs text-[--faint] mt-0.5">{age} anni</p>
          )}
        </div>
      </div>

      {/* ── Stima IRPEF (riepilogo) ────────────────────────────────────────── */}
      {tax.applicable && tax.totalMinor > 0 && (
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-[--ink]">Stima imposta sul reddito</p>
              <p className="text-xs text-[--muted] mt-0.5">
                {EMPLOYMENT_LABELS[profile.employmentType ?? ''] ?? ''}
                {' · '}reddito lordo {fmtEur(profile.annualGrossIncomeMinor ?? 0)}
              </p>
            </div>
            <Link
              href="/dashboard/tasse"
              className="text-xs text-[--brand-text] hover:underline shrink-0"
            >
              Dettaglio in Tasse →
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <Stat
              label="Imponibile"
              value={fmtEur(tax.taxableMinor)}
              size="sm"
            />
            {tax.irpefMinor > 0 && (
              <Stat
                label="IRPEF"
                value={fmtEur(tax.irpefMinor)}
                size="sm"
              />
            )}
            {tax.substituteMinor > 0 && (
              <Stat
                label="Imposta sostitutiva"
                value={fmtEur(tax.substituteMinor)}
                size="sm"
              />
            )}
            {tax.addizionaliMinor > 0 && (
              <Stat
                label="Addizionali (stima)"
                value={fmtEur(tax.addizionaliMinor)}
                size="sm"
              />
            )}
            <Stat
              label="Totale stimato"
              value={fmtEur(tax.totalMinor)}
              size="sm"
              sub={`Aliquota eff. ${fmtPct(tax.effectiveRate)}`}
            />
          </div>

          {/* Scaglioni IRPEF */}
          {tax.brackets.length > 0 && (
            <div className="pt-3 border-t border-[--border]">
              <p className="text-xs text-[--muted] mb-2">Scaglioni IRPEF applicati</p>
              <div className="space-y-1">
                {tax.brackets.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-[--muted]">{fmtPct(b.rate)}</span>
                    <span className="text-[--faint]">su {fmtEur(b.taxedMinor)}</span>
                    <span className="text-[--ink] font-medium tabular-nums">
                      {fmtEur(b.taxMinor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nota limiti stima */}
          {tax.note && (
            <div className="flex items-start gap-2 rounded-lg bg-[--warning]/10 border border-[--warning]/30 px-3 py-2">
              <Info className="size-3.5 text-[--warning] shrink-0 mt-0.5" />
              <p className="text-xs text-[--muted]">{tax.note}</p>
            </div>
          )}
        </Card>
      )}

      {/* Prompt se profilo incompleto */}
      {!tax.applicable && tax.note && (
        <Card className="flex items-start gap-3">
          <AlertTriangle className="size-4 text-[--warning] shrink-0 mt-0.5" />
          <p className="text-sm text-[--muted]">{tax.note}</p>
        </Card>
      )}

      {/* Avviso residenza estera → calcoli fiscali italiani non affidabili */}
      {!isItaly && (
        <Card className="flex items-start gap-3 border-[--warning]/50">
          <AlertTriangle className="size-4 text-[--warning] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-[--ink]">Residenza fiscale estera</p>
            <p className="text-xs text-[--muted]">
              Con residenza fuori dall&apos;Italia, le imposte patrimoniali (bollo/IVAFE)
              potrebbero non applicarsi. I calcoli nella pagina{' '}
              <Link href="/dashboard/tasse" className="text-[--brand-text] hover:underline">Tasse</Link>
              {' '}mostrano i valori indicativi basati sulle regole italiane.
            </p>
          </div>
        </Card>
      )}

      {/* ── Form profilo ──────────────────────────────────────────────────── */}
      <Card className="space-y-6">
        <div>
          <p className="text-sm font-semibold text-[--ink]">Modifica profilo</p>
          <p className="text-xs text-[--muted] mt-0.5">
            I dati fiscali sono usati per stimare il carico tributario nella pagina{' '}
            <Link href="/dashboard/tasse" className="text-[--brand-text] hover:underline">Tasse</Link>.
          </p>
        </div>
        <ProfileForm profile={profile} />
      </Card>
    </main>
  )
}
