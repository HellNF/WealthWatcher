'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui'

interface Props {
  years:       string[]
  selectedYear: string
}

/**
 * Selettore dell'anno fiscale. Aggiorna il query param ?year= via router.replace
 * (no nuova voce history) per fare in modo che il Server Component ricarichi i dati.
 */
export default function YearSelector({ years, selectedYear }: Props) {
  const router = useRouter()

  function handleChange(year: string) {
    const params = new URLSearchParams(window.location.search)
    params.set('year', year)
    router.replace(`/dashboard/tasse?${params.toString()}`)
  }

  return (
    <Select
      value={selectedYear}
      onValueChange={handleChange}
      aria-label="Seleziona anno fiscale"
      className="w-28 tabular-nums privacy-keep"
    >
      {years.map(y => (
        <option key={y} value={y}>{y}</option>
      ))}
    </Select>
  )
}
