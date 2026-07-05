'use client'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function BolloToggle() {
  const sp = useSearchParams()
  const isQuarterly = sp.get('quarterly') === '1'

  const next = new URLSearchParams(sp.toString())
  if (isQuarterly) next.delete('quarterly')
  else next.set('quarterly', '1')

  return (
    <Link href={`?${next.toString()}`} className="text-xs text-[--brand-text] hover:underline">
      {isQuarterly ? 'Mostra annuale' : 'Mostra per trimestre'}
    </Link>
  )
}
