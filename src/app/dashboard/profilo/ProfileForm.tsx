'use client'
import { useActionState, useState } from 'react'
import { saveProfileAction, type ActionState } from './actions'
import { Button, Field, Input, Select } from '@/components/ui'
import type { UserProfile } from '@/lib/userSettings'

// Lista ridotta dei paesi più comuni per la residenza fiscale
const COMMON_COUNTRIES: { code: string; label: string }[] = [
  { code: 'IT', label: 'Italia' },
  { code: 'DE', label: 'Germania' },
  { code: 'FR', label: 'Francia' },
  { code: 'ES', label: 'Spagna' },
  { code: 'CH', label: 'Svizzera' },
  { code: 'GB', label: 'Regno Unito' },
  { code: 'US', label: 'Stati Uniti' },
  { code: 'PT', label: 'Portogallo' },
  { code: 'NL', label: 'Paesi Bassi' },
  { code: 'BE', label: 'Belgio' },
  { code: 'AT', label: 'Austria' },
  { code: 'LU', label: 'Lussemburgo' },
  { code: 'IE', label: 'Irlanda' },
  { code: 'MT', label: 'Malta' },
  { code: 'AE', label: 'Emirati Arabi Uniti' },
  { code: 'SG', label: 'Singapore' },
  { code: 'OTHER', label: 'Altro (specifica sotto)' },
]

const EMPLOYMENT_OPTIONS = [
  { value: '',                          label: '— seleziona —' },
  { value: 'employee',                  label: 'Lavoratore dipendente' },
  { value: 'pensioner',                 label: 'Pensionato' },
  { value: 'self_employed_ordinario',   label: 'Libero professionista (regime ordinario)' },
  { value: 'self_employed_forfettario', label: 'Libero professionista (regime forfettario)' },
  { value: 'none',                      label: 'Altro / nessun reddito da lavoro' },
]

interface Props {
  profile: UserProfile
}

export default function ProfileForm({ profile }: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveProfileAction,
    undefined,
  )

  const [empType, setEmpType] = useState(profile.employmentType ?? '')
  const isForfettario = empType === 'self_employed_forfettario'

  // Reddito annuo lordo: converti da minor units (centesimi) a stringa €
  const defaultIncome = profile.annualGrossIncomeMinor
    ? (profile.annualGrossIncomeMinor / 100).toFixed(2)
    : ''

  return (
    <form action={action} className="space-y-8">

      {/* ── Anagrafica ─────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[--ink]">Dati anagrafici</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nome visualizzato" htmlFor="display-name">
            <Input
              id="display-name"
              name="display_name"
              type="text"
              defaultValue={profile.displayName ?? ''}
              placeholder="Es. Mario Rossi"
              maxLength={100}
            />
          </Field>
          <Field label="Data di nascita" htmlFor="birth-date">
            <Input
              id="birth-date"
              name="birth_date"
              type="date"
              defaultValue={profile.birthDate ?? ''}
            />
          </Field>
        </div>
      </section>

      {/* ── Residenza fiscale ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[--ink]">Residenza fiscale</h3>
        <p className="text-xs text-[--muted]">
          La residenza fiscale determina quale regime di tassazione si applica.
          Per i residenti in Italia si usa il regime IRPEF + capital gain italiano.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Paese di residenza fiscale" htmlFor="tax-residency">
            <Select id="tax-residency" name="tax_residency" defaultValue={profile.taxResidency}>
              {COMMON_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code === 'OTHER' ? '' : c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      {/* ── Lavoro e reddito ───────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[--ink]">Lavoro e reddito</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tipo di impiego" htmlFor="employment-type">
            <Select
              id="employment-type"
              name="employment_type"
              value={empType}
              onChange={(e) => setEmpType(e.target.value)}
            >
              {EMPLOYMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Reddito annuo lordo (€)" htmlFor="annual-income">
            <Input
              id="annual-income"
              name="annual_gross_income"
              type="number"
              step="0.01"
              min="0"
              defaultValue={defaultIncome}
              placeholder="es. 35000.00"
            />
          </Field>
          <Field label="Regime capital gain" htmlFor="cg-regime">
            <Select
              id="cg-regime"
              name="capital_gains_regime"
              defaultValue={profile.capitalGainsRegime ?? ''}
            >
              <option value="">— seleziona —</option>
              <option value="amministrato">
                Amministrato (il broker trattiene le imposte)
              </option>
              <option value="dichiarativo">
                Dichiarativo (dichiari e paghi tu in autonomia)
              </option>
            </Select>
          </Field>
        </div>

        {/* Campi specifici per regime forfettario */}
        {isForfettario && (
          <div className="rounded-xl border border-[--border] bg-[--surface-2] p-4 space-y-4">
            <p className="text-xs font-medium text-[--ink]">Parametri regime forfettario</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Coefficiente di redditività (%)"
                htmlFor="forfettario-coeff"
              >
                <Input
                  id="forfettario-coeff"
                  name="forfettario_coefficient"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  defaultValue={profile.forfettarioCoefficient ?? 78}
                  placeholder="78"
                />
              </Field>
              <Field
                label="Aliquota agevolata startup (5%)"
                htmlFor="forfettario-startup"
              >
                <div className="flex items-center gap-2 h-9">
                  <input
                    id="forfettario-startup"
                    name="forfettario_startup"
                    type="checkbox"
                    defaultChecked={profile.forfettarioStartup}
                    className="h-4 w-4 rounded border-[--border] accent-[--brand]"
                  />
                  <label htmlFor="forfettario-startup" className="text-sm text-[--muted]">
                    Attività avviata da meno di 5 anni
                  </label>
                </div>
              </Field>
            </div>
            <p className="text-xs text-[--faint]">
              Il coefficiente varia per categoria ATECO: es. 78% commercio, 67% artigianato, 86%
              professionisti. Verifica il tuo valore nelle istruzioni del modello Redditi PF.
            </p>
          </div>
        )}
      </section>

      {/* ── Feedback e salva ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap pt-2 border-t border-[--border]">
        <Button type="submit" loading={pending}>Salva profilo</Button>
        {state?.success && (
          <p className="text-xs text-[--brand-text]" role="status">{state.success}</p>
        )}
        {state?.error && (
          <p className="text-xs text-[--danger]" role="alert">{state.error}</p>
        )}
      </div>
    </form>
  )
}
