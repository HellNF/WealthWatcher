import { requireUser } from '@/lib/dal'
import { hasOpenAiKey, getOpenAiKeySetAt } from '@/lib/userSettings'
import OpenAiKeyForm from './OpenAiKeyForm'
import { Breadcrumb, Card, CardHeader, CardTitle, CardDescription } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user = await requireUser()
  const hasKey = hasOpenAiKey(user.id)
  const setAt  = getOpenAiKeySetAt(user.id)

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Impostazioni' },
      ]} />

      <Card className="max-w-xl">
        <CardHeader>
          <div>
            <CardTitle>Chiave API OpenAI</CardTitle>
            <CardDescription>
              Necessaria per importare i dati dai documenti KID (PDF). Ottienila da{' '}
              <span className="text-[--ink]">platform.openai.com/api-keys</span>.
            </CardDescription>
          </div>
        </CardHeader>
        <OpenAiKeyForm hasKey={hasKey} setAt={setAt} />
      </Card>
    </main>
  )
}
