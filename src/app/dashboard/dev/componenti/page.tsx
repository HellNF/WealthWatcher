// src/app/dashboard/dev/componenti/page.tsx — Banco di prova dei componenti di
// libreria (Select, Tooltip, ConfirmDialog, toast, cifra animata) con dati
// "gentili" e dati peggiori realistici. Solo sviluppo: in produzione esiste
// soltanto se WW_DEV_PAGES=1 (per le prove headless su copia del DB).
import { notFound } from 'next/navigation'
import Playground from './Playground'
import { FIXTURES, type FixtureId } from './fixtures'

export default async function Page({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  if (process.env.NODE_ENV === 'production' && process.env.WW_DEV_PAGES !== '1') notFound()
  const { data } = await searchParams
  const id = (data && data in FIXTURES ? data : 'demo') as FixtureId
  return <Playground id={id} fixture={FIXTURES[id]} />
}
