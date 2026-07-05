import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/dal'
import { getAccountForUser } from '@/lib/accounts'
import { getInstitutionForUser } from '@/lib/institutions'
import { getProvider, providerParser } from '@/lib/providers'
import ImportForm from './ImportForm'
import { Breadcrumb, Card, EmptyState, Button } from '@/components/ui'
import { FileX2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

// Istruzioni di export per banca (parser key → testo).
const HINTS: Record<string, string> = {
  intesa_xlsx: 'Esporta “Lista Operazioni” da Intesa Sanpaolo → Estratti Conto in formato Excel (.xlsx) e caricala qui.',
  bbva_xlsx:   'Esporta i movimenti da BBVA (sezione Movimenti → Esporta) in formato Excel (.xlsx) e caricali qui.',
  revolut_csv: 'Vai su Revolut → Conti → seleziona il conto → Estratto conto → CSV (lingua inglese). Carica il file .csv qui.',
}

// Estensioni accettate per tipo di parser.
const FILE_ACCEPT: Record<string, string> = {
  intesa_xlsx: '.xlsx,.xls',
  bbva_xlsx:   '.xlsx,.xls',
  revolut_csv: '.csv',
}

const FILE_LABEL: Record<string, string> = {
  intesa_xlsx: 'File Excel (.xlsx)',
  bbva_xlsx:   'File Excel (.xlsx)',
  revolut_csv: 'File CSV (.csv)',
}

export default async function ImportPage({ params }: Props) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) notFound()

  const user = await requireUser()
  const account = getAccountForUser(user.id, id)
  if (!account) notFound()

  const institution = getInstitutionForUser(user.id, account.institution_id)
  const provider = getProvider(institution?.provider)
  const parserKey = providerParser(institution?.provider)

  const crumbs = (
    <Breadcrumb items={[
      { label: 'Dashboard', href: '/dashboard' },
      ...(institution ? [{ label: institution.name, href: `/dashboard/institutions/${institution.id}` }] : []),
      { label: account.name, href: `/dashboard/accounts/${id}` },
      { label: 'Importa movimenti' },
    ]} />
  )

  if (!parserKey) {
    return (
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {crumbs}
        <Card>
          <EmptyState
            icon={FileX2}
            title="Import non disponibile per questa banca"
            description={`L'import automatico dell'estratto conto non è ancora supportato${provider ? ` per ${provider.name}` : ''}. Puoi inserire i movimenti manualmente dalla pagina del conto.`}
            action={
              <Link href={`/dashboard/accounts/${id}`}>
                <Button variant="secondary">Torna al conto</Button>
              </Link>
            }
          />
        </Card>
      </main>
    )
  }

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {crumbs}

      <div>
        <h1 className="text-lg font-semibold text-[--ink]">
          Importa movimenti{provider ? ` — ${provider.name}` : ''}
        </h1>
        <p className="text-sm text-[--muted] mt-1">
          {HINTS[parserKey] ?? 'Carica l’estratto conto in formato Excel (.xlsx).'}
        </p>
      </div>

      <ImportForm
        accountId={id}
        fileAccept={FILE_ACCEPT[parserKey] ?? '.xlsx,.xls,.csv'}
        fileLabel={FILE_LABEL[parserKey] ?? 'File estratto conto'}
      />
    </main>
  )
}
