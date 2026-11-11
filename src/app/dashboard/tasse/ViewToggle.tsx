'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Segmented } from '@/components/ui/Segmented'

/**
 * Essenziale | Avanzata: aggiorna ?vista= con router.replace (nessuna voce nella
 * cronologia) preservando gli altri parametri; il Server Component rilegge
 * searchParams e cambia profondità. Default: Essenziale (nessun parametro).
 */
export default function ViewToggle() {
  const router = useRouter()
  const sp     = useSearchParams()

  function go(view: 'base' | 'avanzata') {
    const params = new URLSearchParams(sp.toString())
    if (view === 'avanzata') params.set('vista', 'avanzata')
    else params.delete('vista')
    router.replace(`/dashboard/tasse?${params.toString()}`, { scroll: false })
  }

  return (
    <Segmented
      label="Livello di dettaglio"
      value={sp.get('vista') === 'avanzata' ? 'avanzata' : 'base'}
      onChange={go}
      options={[
        { value: 'base',     label: 'Essenziale' },
        { value: 'avanzata', label: 'Avanzata' },
      ]}
    />
  )
}
