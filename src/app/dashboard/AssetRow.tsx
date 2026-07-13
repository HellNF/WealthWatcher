'use client'
import { useState, useActionState, useEffect, useRef, useTransition } from 'react'
import { Pencil, X, RefreshCw } from 'lucide-react'
import { Button, Field, Input, Select, Badge, ConfirmDelete } from '@/components/ui'
import { updateAssetAction, deleteAssetAction, refreshVehicleEstimateAction } from './assets-actions'
import { ASSET_KINDS, KIND_MAP } from './assetKinds'
import { FUEL_OPTIONS, GEARBOX_OPTIONS, COUNTRY_OPTIONS, DRIVETRAIN_OPTIONS } from './vehicleFields'
import { fromMinor } from '@/lib/money'
import { formatDateIt } from '@/lib/formatDate'
import type { Asset, VehicleDetails } from '@/lib/assets'

type State = { error?: string } | undefined

// Badge per vehicleDetails.last_estimate_confidence: 'high' non mostra badge
// (è il caso atteso), 'medium'/'low' segnalano quanto i filtri di ricerca
// comparabili sono stati allentati per trovare un campione sufficiente.
const CONFIDENCE_BADGE: Record<string, { label: string; variant: 'neutral' | 'warning'; title: string }> = {
  medium: { label: 'confidenza media', variant: 'neutral', title: 'Stima con filtri di ricerca parzialmente allentati (es. cambio o potenza non filtrati)' },
  low:    { label: 'confidenza bassa', variant: 'warning', title: 'Stima con filtri di ricerca molto allentati per mancanza di annunci comparabili — trattare con cautela' },
}

export default function AssetRow({
  asset,
  vehicleDetails,
}: {
  asset: Asset
  vehicleDetails?: VehicleDetails
}) {
  const [editing, setEditing] = useState(false)
  const [state, action, pending] = useActionState<State, FormData>(
    updateAssetAction.bind(null, asset.id),
    undefined,
  )
  const wasPending = useRef(false)
  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) setEditing(false)
    wasPending.current = pending
  }, [pending, state])

  const [refreshPending, startRefresh] = useTransition()
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const kind = KIND_MAP[asset.kind] ?? KIND_MAP.other
  const Icon = kind.Icon

  if (editing) {
    return (
      <div className="px-5 py-4 space-y-1">
        <form action={action} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
            <Field label="Nome" htmlFor={`a-name-${asset.id}`} className="flex-1 min-w-40">
              <Input id={`a-name-${asset.id}`} name="name" defaultValue={asset.name} required autoFocus maxLength={100} />
            </Field>
            <Field label="Tipo" htmlFor={`a-kind-${asset.id}`}>
              <Select id={`a-kind-${asset.id}`} name="kind" defaultValue={asset.kind}>
                {ASSET_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Valore" htmlFor={`a-val-${asset.id}`}>
              <Input
                id={`a-val-${asset.id}`}
                name="value"
                type="number"
                step="0.01"
                defaultValue={(asset.value_minor / 100).toFixed(2)}
                required
                className="max-w-32"
              />
            </Field>
            <Field label="Valuta" htmlFor={`a-cur-${asset.id}`}>
              <Input id={`a-cur-${asset.id}`} name="currency" defaultValue={asset.currency} maxLength={3} className="max-w-20 uppercase" />
            </Field>
            <div className="flex gap-2 shrink-0">
              <Button type="submit" loading={pending}>Salva</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)} aria-label="Annulla">
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {asset.kind === 'vehicle' && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap p-3 rounded-lg bg-[--surface-2]">
              <Field label="Marca" htmlFor={`a-vmake-${asset.id}`} className="min-w-32">
                <Input id={`a-vmake-${asset.id}`} name="vehicle_make" defaultValue={vehicleDetails?.make} required maxLength={50} />
              </Field>
              <Field label="Modello" htmlFor={`a-vmodel-${asset.id}`} className="min-w-32">
                <Input id={`a-vmodel-${asset.id}`} name="vehicle_model" defaultValue={vehicleDetails?.model} required maxLength={50} />
              </Field>
              <Field label="Anno" htmlFor={`a-vyear-${asset.id}`}>
                <Input id={`a-vyear-${asset.id}`} name="vehicle_year" type="number" defaultValue={vehicleDetails?.year} required className="max-w-24" />
              </Field>
              <Field label="Alimentazione" htmlFor={`a-vfuel-${asset.id}`}>
                <Select id={`a-vfuel-${asset.id}`} name="vehicle_fuel" defaultValue={vehicleDetails?.fuel ?? ''}>
                  <option value="">—</option>
                  {FUEL_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Cambio" htmlFor={`a-vgear-${asset.id}`}>
                <Select id={`a-vgear-${asset.id}`} name="vehicle_gearbox" defaultValue={vehicleDetails?.gearbox ?? ''}>
                  <option value="">—</option>
                  {GEARBOX_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Potenza CV (opz.)" htmlFor={`a-vpower-${asset.id}`}>
                <Input id={`a-vpower-${asset.id}`} name="vehicle_power_hp" type="number" defaultValue={vehicleDetails?.power_hp ?? undefined} className="max-w-28" />
              </Field>
              <Field label="Cilindrata cc (opz.)" htmlFor={`a-vdisp-${asset.id}`}>
                <Input id={`a-vdisp-${asset.id}`} name="vehicle_displacement_cc" type="number" defaultValue={vehicleDetails?.displacement_cc ?? undefined} className="max-w-28" />
              </Field>
              <Field label="Km attuali" htmlFor={`a-vkm-${asset.id}`}>
                <Input id={`a-vkm-${asset.id}`} name="vehicle_mileage" type="number" defaultValue={vehicleDetails?.mileage_km} required className="max-w-28" />
              </Field>
              <Field label="Km/anno (opz.)" htmlFor={`a-vakm-${asset.id}`}>
                <Input id={`a-vakm-${asset.id}`} name="vehicle_annual_km" type="number" defaultValue={vehicleDetails?.annual_km ?? undefined} className="max-w-28" />
              </Field>
              <Field label="Prezzo pagato (opz.)" htmlFor={`a-vprice-${asset.id}`}>
                <Input
                  id={`a-vprice-${asset.id}`}
                  name="vehicle_purchase_price"
                  type="number"
                  step="0.01"
                  defaultValue={vehicleDetails?.purchase_price_minor != null ? (vehicleDetails.purchase_price_minor / 100).toFixed(2) : undefined}
                  className="max-w-32"
                />
              </Field>
              <Field label="Paese ricerca" htmlFor={`a-vcountry-${asset.id}`}>
                <Select id={`a-vcountry-${asset.id}`} name="vehicle_country" defaultValue={vehicleDetails?.country ?? 'IT'}>
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Trazione (opz., non filtra la stima)" htmlFor={`a-vdrive-${asset.id}`}>
                <Select id={`a-vdrive-${asset.id}`} name="vehicle_drivetrain" defaultValue={vehicleDetails?.drivetrain ?? ''}>
                  <option value="">—</option>
                  {DRIVETRAIN_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </Select>
              </Field>
              <label className="flex items-center gap-1.5 text-sm text-[--muted] pb-2 select-none">
                <input type="checkbox" name="vehicle_auto_estimate" defaultChecked={vehicleDetails ? !!vehicleDetails.auto_estimate : true} className="size-4" />
                Stima automatica da AutoScout24
              </label>
            </div>
          )}
        </form>
        {state?.error && <p className="text-xs text-[--danger]">{state.error}</p>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="size-10 rounded-xl bg-[--surface-2] flex items-center justify-center shrink-0">
        <Icon className="size-5 text-[--muted]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[--ink] truncate">{asset.name}</p>
        <p className="text-xs text-[--muted] flex items-center gap-1.5 flex-wrap">
          {kind.label}
          {vehicleDetails && (
            <>
              <span>
                · {vehicleDetails.make} {vehicleDetails.model} ({vehicleDetails.year})
                {vehicleDetails.power_hp ? ` · ${vehicleDetails.power_hp} CV` : ''}
                {vehicleDetails.displacement_cc ? ` · ${vehicleDetails.displacement_cc} cc` : ''}
                {' · '}{COUNTRY_OPTIONS.find((c) => c.value === vehicleDetails.country)?.label ?? vehicleDetails.country}
                {vehicleDetails.purchase_price_minor != null ? ` · pagato ${fromMinor(vehicleDetails.purchase_price_minor, asset.currency)}` : ''}
              </span>
              {vehicleDetails.auto_estimate ? (
                vehicleDetails.last_estimate_at ? (
                  <>
                    <span>· stima {formatDateIt(vehicleDetails.last_estimate_at)}</span>
                    {vehicleDetails.last_estimate_confidence && CONFIDENCE_BADGE[vehicleDetails.last_estimate_confidence] && (
                      <Badge
                        variant={CONFIDENCE_BADGE[vehicleDetails.last_estimate_confidence].variant}
                        title={CONFIDENCE_BADGE[vehicleDetails.last_estimate_confidence].title}
                      >
                        {CONFIDENCE_BADGE[vehicleDetails.last_estimate_confidence].label}
                      </Badge>
                    )}
                  </>
                ) : (
                  <Badge variant="warning">stima non ancora effettuata</Badge>
                )
              ) : (
                <Badge variant="neutral">stima manuale</Badge>
              )}
              {refreshError && <Badge variant="warning" title={refreshError}>stale</Badge>}
            </>
          )}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="font-mono tabular-nums text-sm font-medium text-[--ink]">
          {fromMinor(asset.value_minor, asset.currency)}
        </span>
        {vehicleDetails?.purchase_price_minor != null && vehicleDetails.purchase_price_minor > 0 && (() => {
          // Confronto valore attuale vs prezzo pagato, stessa valuta dell'asset
          // (purchase_price_minor non ha una valuta propria). Solo informativo —
          // il patrimonio netto usa sempre asset.value_minor, mai questo prezzo.
          const pct = ((asset.value_minor - vehicleDetails.purchase_price_minor) / vehicleDetails.purchase_price_minor) * 100
          return (
            <Badge variant={pct >= 0 ? 'gain' : 'loss'} title="Rispetto al prezzo pagato">
              {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
            </Badge>
          )
        })()}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {vehicleDetails?.auto_estimate && (
          <Button
            variant="ghost"
            size="sm"
            loading={refreshPending}
            aria-label="Aggiorna stima"
            onClick={() => {
              setRefreshError(null)
              startRefresh(async () => {
                const res = await refreshVehicleEstimateAction(asset.id)
                if (res?.error) setRefreshError(res.error)
              })
            }}
          >
            <RefreshCw className="size-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label="Modifica">
          <Pencil className="size-3.5" />
        </Button>
        <ConfirmDelete
          action={deleteAssetAction.bind(null, asset.id)}
          label=""
          confirmText="Eliminare questo bene?"
        />
      </div>
    </div>
  )
}
