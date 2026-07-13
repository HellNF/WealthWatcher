// src/__tests__/lib/assets-actions-parse.test.ts
// Verifica che la validazione zod di parseAssetForm si comporti come la
// validazione manuale che sostituisce: stessi campi obbligatori, stessi
// range, stessi messaggi d'errore attesi dalla UI.
import { parseAssetForm } from '@/app/dashboard/assets-parse'

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('parseAssetForm — asset non-veicolo', () => {
  test('accetta un asset cash valido', () => {
    const result = parseAssetForm(formData({ name: 'Conto deposito', kind: 'cash', currency: 'EUR', value: '1000.50' }))
    expect(result).toEqual({ name: 'Conto deposito', kind: 'cash', currency: 'EUR', valueMinor: 100050 })
  })

  test('rifiuta nome mancante', () => {
    const result = parseAssetForm(formData({ name: '', kind: 'cash', currency: 'EUR', value: '100' }))
    expect(result).toEqual({ error: 'Nome obbligatorio' })
  })

  test('rifiuta nome troppo lungo', () => {
    const result = parseAssetForm(formData({ name: 'x'.repeat(101), kind: 'cash', currency: 'EUR', value: '100' }))
    expect(result).toEqual({ error: 'Nome troppo lungo' })
  })

  test('rifiuta kind non valido', () => {
    const result = parseAssetForm(formData({ name: 'Test', kind: 'crypto', currency: 'EUR', value: '100' }))
    expect(result).toEqual({ error: 'Tipo non valido' })
  })

  test('rifiuta valuta non a 3 lettere', () => {
    const result = parseAssetForm(formData({ name: 'Test', kind: 'cash', currency: 'EU', value: '100' }))
    expect(result).toEqual({ error: 'Valuta non valida (codice ISO a 3 lettere)' })
  })

  test('normalizza la valuta in maiuscolo', () => {
    const result = parseAssetForm(formData({ name: 'Test', kind: 'cash', currency: 'eur', value: '100' }))
    expect('error' in result).toBe(false)
    if (!('error' in result)) expect(result.currency).toBe('EUR')
  })

  test('rifiuta un valore non numerico', () => {
    const result = parseAssetForm(formData({ name: 'Test', kind: 'cash', currency: 'EUR', value: 'abc' }))
    expect(result).toEqual({ error: 'Valore non valido' })
  })

  test('accetta la virgola come separatore decimale', () => {
    const result = parseAssetForm(formData({ name: 'Test', kind: 'cash', currency: 'EUR', value: '1234,56' }))
    expect('error' in result).toBe(false)
    if (!('error' in result)) expect(result.valueMinor).toBe(123456)
  })
})

describe('parseAssetForm — veicolo', () => {
  const validVehicle = {
    name: 'Auto', kind: 'vehicle', currency: 'EUR', value: '20000',
    vehicle_make: 'Toyota', vehicle_model: 'Yaris', vehicle_year: '2020', vehicle_mileage: '30000',
    vehicle_country: 'IT',
  }

  test('accetta un veicolo con i soli campi obbligatori', () => {
    const result = parseAssetForm(formData(validVehicle))
    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.vehicle).toMatchObject({ make: 'Toyota', model: 'Yaris', year: 2020, mileageKm: 30000, country: 'IT' })
    }
  })

  test('rifiuta marca mancante', () => {
    const result = parseAssetForm(formData({ ...validVehicle, vehicle_make: '' }))
    expect(result).toEqual({ error: 'Marca obbligatoria per un veicolo' })
  })

  test('rifiuta modello mancante', () => {
    const result = parseAssetForm(formData({ ...validVehicle, vehicle_model: '' }))
    expect(result).toEqual({ error: 'Modello obbligatorio per un veicolo' })
  })

  test('rifiuta anno fuori range', () => {
    expect(parseAssetForm(formData({ ...validVehicle, vehicle_year: '1900' }))).toEqual({ error: 'Anno non valido' })
    expect(parseAssetForm(formData({ ...validVehicle, vehicle_year: '3000' }))).toEqual({ error: 'Anno non valido' })
  })

  test('rifiuta chilometraggio negativo', () => {
    expect(parseAssetForm(formData({ ...validVehicle, vehicle_mileage: '-1' }))).toEqual({ error: 'Chilometraggio non valido' })
  })

  test('rifiuta paese non supportato', () => {
    expect(parseAssetForm(formData({ ...validVehicle, vehicle_country: 'US' }))).toEqual({ error: 'Paese di ricerca non valido' })
  })

  test('accetta alimentazione/cambio/trazione validi e li normalizza a null se assenti', () => {
    const withOptionals = parseAssetForm(formData({
      ...validVehicle, vehicle_fuel: 'diesel', vehicle_gearbox: 'automatic', vehicle_drivetrain: 'awd',
    }))
    expect('error' in withOptionals).toBe(false)
    if (!('error' in withOptionals)) {
      expect(withOptionals.vehicle).toMatchObject({ fuel: 'diesel', gearbox: 'automatic', drivetrain: 'awd' })
    }

    const withoutOptionals = parseAssetForm(formData(validVehicle))
    if (!('error' in withoutOptionals)) {
      expect(withoutOptionals.vehicle).toMatchObject({ fuel: null, gearbox: null, drivetrain: null })
    }
  })

  test('rifiuta alimentazione non valida', () => {
    expect(parseAssetForm(formData({ ...validVehicle, vehicle_fuel: 'nuclear' }))).toEqual({ error: 'Alimentazione non valida' })
  })

  test('rifiuta cambio non valido', () => {
    expect(parseAssetForm(formData({ ...validVehicle, vehicle_gearbox: 'cvt' }))).toEqual({ error: 'Cambio non valido' })
  })

  test('rifiuta km/anno negativi', () => {
    expect(parseAssetForm(formData({ ...validVehicle, vehicle_annual_km: '-500' }))).toEqual({ error: 'Km/anno non validi' })
  })

  test('rifiuta potenza non positiva', () => {
    expect(parseAssetForm(formData({ ...validVehicle, vehicle_power_hp: '0' }))).toEqual({ error: 'Potenza non valida' })
  })

  test('rifiuta cilindrata non positiva', () => {
    expect(parseAssetForm(formData({ ...validVehicle, vehicle_displacement_cc: '-100' }))).toEqual({ error: 'Cilindrata non valida' })
  })

  test('rifiuta prezzo di acquisto non numerico', () => {
    expect(parseAssetForm(formData({ ...validVehicle, vehicle_purchase_price: 'abc' }))).toEqual({ error: 'Prezzo di acquisto non valido' })
  })

  test('accetta prezzo di acquisto valido e lo converte in minor units', () => {
    const result = parseAssetForm(formData({ ...validVehicle, vehicle_purchase_price: '25000.99' }))
    expect('error' in result).toBe(false)
    if (!('error' in result)) expect(result.vehicle?.purchasePriceMinor).toBe(2500099)
  })

  test('vehicle_auto_estimate "on" diventa true, assente diventa false', () => {
    const on = parseAssetForm(formData({ ...validVehicle, vehicle_auto_estimate: 'on' }))
    if (!('error' in on)) expect(on.vehicle?.autoEstimate).toBe(true)

    const off = parseAssetForm(formData(validVehicle))
    if (!('error' in off)) expect(off.vehicle?.autoEstimate).toBe(false)
  })
})
