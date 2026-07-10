import { headers } from 'next/headers'
import { requireUser } from '@/lib/dal'
import {
  hasOpenAiKey, getOpenAiKeySetAt, getUserProfile,
  hasEnableBankingKey, getEnableBankingKeySetAt,
} from '@/lib/userSettings'
import { listAllowedEmails } from '@/lib/users'
import { listCategoryRules } from '@/lib/merchants'
import { listAllCategories } from '@/lib/transactions'
import OpenAiKeyForm from './OpenAiKeyForm'
import EnableBankingKeyForm from './EnableBankingKeyForm'
import AllowlistManager from './AllowlistManager'
import CategoryRulesManager from './CategoryRulesManager'
import FiscalProfileForm from './FiscalProfileForm'
import { Breadcrumb, Card, CardHeader, CardTitle, CardDescription } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user       = await requireUser()
  const hasKey     = hasOpenAiKey(user.id)
  const setAt      = getOpenAiKeySetAt(user.id)
  const hasEbKey   = hasEnableBankingKey(user.id)
  const ebSetAt    = getEnableBankingKeySetAt(user.id)

  // URL di redirect da whitelistare nel Control Panel Enable Banking — dedotto
  // dall'host della richiesta corrente così l'utente lo copia senza indovinare
  // dominio/protocollo (dietro proxy usiamo l'header x-forwarded-*, come fa auth.ts).
  const hdrs  = await headers()
  const host  = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const ebRedirectUrl = `${proto}://${host}/api/banking/callback`

  const isAdmin    = user.role === 'admin'
  const allowlist  = isAdmin ? listAllowedEmails() : []
  const rules      = listCategoryRules(user.id)
  const categories = listAllCategories()
  const profile    = getUserProfile(user.id)

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Impostazioni' },
      ]} />

      {/* Profilo fiscale */}
      <Card className="max-w-xl">
        <CardHeader>
          <div>
            <CardTitle>Profilo fiscale</CardTitle>
            <CardDescription>
              Usato per stimare il risparmio IRPEF generato dai contributi ai fondi pensione integrativi.
            </CardDescription>
          </div>
        </CardHeader>
        <FiscalProfileForm currentRate={profile.irpefMarginalRate} />
      </Card>

      {/* Regole di categorizzazione — visibile a tutti */}
      <Card className="max-w-2xl">
        <CardHeader>
          <div>
            <CardTitle>Regole di categorizzazione</CardTitle>
            <CardDescription>
              Se la descrizione di un movimento contiene la parola chiave, viene
              assegnata automaticamente la categoria scelta. Queste regole hanno
              priorità su tutto: si applicano durante l&apos;import e possono essere
              ri-applicate allo storico.
            </CardDescription>
          </div>
        </CardHeader>
        <CategoryRulesManager rules={rules} categories={categories} />
      </Card>

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

      <Card className="max-w-2xl">
        <CardHeader>
          <div>
            <CardTitle>Open Banking (Enable Banking)</CardTitle>
            <CardDescription>
              Necessaria per collegare le tue banche e importare saldi e movimenti
              automaticamente. Il piano gratuito richiede un&apos;app registrata a testa.
            </CardDescription>
          </div>
        </CardHeader>
        <EnableBankingKeyForm hasKey={hasEbKey} setAt={ebSetAt} redirectUrl={ebRedirectUrl} />
      </Card>

      {isAdmin && (
        <Card className="max-w-xl">
          <CardHeader>
            <div>
              <CardTitle>Whitelist accessi</CardTitle>
              <CardDescription>
                Solo le email in questa lista possono accedere all&apos;app.
                Aggiungila qui prima di condividere l&apos;accesso con qualcuno.
              </CardDescription>
            </div>
          </CardHeader>
          <AllowlistManager
            entries={allowlist}
            currentEmail={user.email}
          />
        </Card>
      )}
    </main>
  )
}
