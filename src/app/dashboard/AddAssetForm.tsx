'use client'
import { useState, useActionState } from 'react'
import { Plus } from 'lucide-react'
import { Button, Field, Input, Select } from '@/components/ui'
import { addAssetAction } from './assets-actions'
import { ASSET_KINDS } from './assetKinds'
import { FUEL_OPTIONS, GEARBOX_OPTIONS, COUNTRY_OPTIONS, DRIVETRAIN_OPTIONS } from './vehicleFields'

type State = { error?: string } | undefined

export default function AddAssetForm() {
  const [state, action, pending] = useActionState<State, FormData>(addAssetAction, undefined)
  const [kind, setKind] = useState('cash')

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
        <Field label="Nome" htmlFor="asset-name" className="flex-1 min-w-40">
          <Input id="asset-name" name="name" required placeholder="es. Contanti, Casa, Auto" maxLength={100} />
        </Field>
        <Field label="Tipo" htmlFor="asset-kind">
          <Select id="asset-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {ASSET_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Valore" htmlFor="asset-value">
          <Input id="asset-value" name="value" type="number" step="0.01" required placeholder="0.00" className="max-w-32" />
        </Field>
        <Field label="Valuta" htmlFor="asset-currency">
          <Input id="asset-currency" name="currency" defaultValue="EUR" maxLength={3} className="max-w-20 uppercase" />
        </Field>
        <Button type="submit" loading={pending} className="shrink-0 self-end">
          <Plus className="size-4" />
          Aggiungi
        </Button>
      </div>

      {kind === 'vehicle' && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap p-3 rounded-lg bg-[--surface-2]">
          <Field label="Marca" htmlFor="asset-vehicle-make" className="min-w-32">
            <Input id="asset-vehicle-make" name="vehicle_make" required placeholder="es. Volkswagen" maxLength={50} />
          </Field>
          <Field label="Modello" htmlFor="asset-vehicle-model" className="min-w-32">
            <Input id="asset-vehicle-model" name="vehicle_model" required placeholder="es. Golf" maxLength={50} />
          </Field>
          <Field label="Anno" htmlFor="asset-vehicle-year">
            <Input id="asset-vehicle-year" name="vehicle_year" type="number" required placeholder="2020" className="max-w-24" />
          </Field>
          <Field label="Alimentazione" htmlFor="asset-vehicle-fuel">
            <Select id="asset-vehicle-fuel" name="vehicle_fuel" defaultValue="">
              <option value="">—</option>
              {FUEL_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Cambio" htmlFor="asset-vehicle-gearbox">
            <Select id="asset-vehicle-gearbox" name="vehicle_gearbox" defaultValue="">
              <option value="">—</option>
              {GEARBOX_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Potenza CV (opz.)" htmlFor="asset-vehicle-power">
            <Input id="asset-vehicle-power" name="vehicle_power_hp" type="number" placeholder="150" className="max-w-28" />
          </Field>
          <Field label="Cilindrata cc (opz.)" htmlFor="asset-vehicle-displacement">
            <Input id="asset-vehicle-displacement" name="vehicle_displacement_cc" type="number" placeholder="1968" className="max-w-28" />
          </Field>
          <Field label="Km attuali" htmlFor="asset-vehicle-mileage">
            <Input id="asset-vehicle-mileage" name="vehicle_mileage" type="number" required placeholder="98000" className="max-w-28" />
          </Field>
          <Field label="Km/anno (opz.)" htmlFor="asset-vehicle-annual-km">
            <Input id="asset-vehicle-annual-km" name="vehicle_annual_km" type="number" placeholder="15000" className="max-w-28" />
          </Field>
          <Field label="Prezzo pagato (opz.)" htmlFor="asset-vehicle-purchase-price">
            <Input id="asset-vehicle-purchase-price" name="vehicle_purchase_price" type="number" step="0.01" placeholder="25000.00" className="max-w-32" />
          </Field>
          <Field label="Paese ricerca" htmlFor="asset-vehicle-country">
            <Select id="asset-vehicle-country" name="vehicle_country" defaultValue="IT">
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Trazione (opz., non filtra la stima)" htmlFor="asset-vehicle-drivetrain">
            <Select id="asset-vehicle-drivetrain" name="vehicle_drivetrain" defaultValue="">
              <option value="">—</option>
              {DRIVETRAIN_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-1.5 text-sm text-[--muted] pb-2 select-none">
            <input type="checkbox" name="vehicle_auto_estimate" defaultChecked className="size-4" />
            Stima automatica da AutoScout24
          </label>
        </div>
      )}

      {state?.error && <p className="text-sm text-[--danger]">{state.error}</p>}
    </form>
  )
}
