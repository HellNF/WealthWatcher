import { headers } from 'next/headers'
import { requireUser } from '@/lib/dal'
import {
  hasOpenAiKey, getOpenAiKeySetAt, getUserProfile,
  hasEnableBankingKey, getEnableBankingKeySetAt,
} from '@/lib/userSettings'
import { listAllowedEmails } from '@/lib/users'
import { listCategoryRules } from '@/lib/merchants'
import { listAllCategories } from '@/lib/transactions'
import { listApiTokens } from '@/lib/apiTokens'
import OpenAiKeyForm from './OpenAiKeyForm'
import EnableBankingKeyForm from './EnableBankingKeyForm'
import AllowlistManager from './AllowlistManager'
import CategoryRulesManager from './CategoryRulesManager'
import FiscalProfileForm from './FiscalProfileForm'
import ApiTokensManager from './ApiTokensManager'
import { Card, CardHeader, CardTitle, CardDescription, PageHeader, HeroShell, Eyebrow, PAGE_SHELL } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const user       = await requireUser()
  const hasKey     = hasOpenAiKey(user.id)
  const setAt      = getOpenAiKeySetAt(user.id)
  const hasEbKey   = hasEnableBankingKey(user.id)
  const ebSetAt    = getEnableBankingKeySetAt(user.id)

  // URL da inserire nel form di registrazione app sul Control Panel Enable
  // Banking (redirect, privacy, termini) — dedotti dall'host della richiesta
  // corrente così l'utente li copia senza indovinare dominio/protocollo
  // (dietro proxy usiamo l'header x-forwarded-*, come fa auth.ts).
  const hdrs  = await headers()
  const host  = hdrs.get('x-forwarded-host') ?? hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const origin = `${proto}://${host}`
  const ebRedirectUrl = `${origin}/api/banking/callback`
  const ebPrivacyUrl  = `${origin}/privacy`
  const ebTermsUrl    = `${origin}/terms`

  const isAdmin    = user.role === 'admin'
  const allowlist  = isAdmin ? listAllowedEmails() : []
  const rules      = listCategoryRules(user.id)
  const categories = listAllCategories()
  const profile    = getUserProfile(user.id)
  const apiTokens  = listApiTokens(user.id)

  const rateLabel = profile.irpefMarginalRate != null
    ? `${(profile.irpefMarginalRate * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`
    : 'Da impostare'
  const tiles: { href: string; label: string; value: string; sub: string }[] = [
    { href: '#fiscale',   label: 'Aliquota IRPEF',        value: rateLabel,                              sub: 'per la stima del risparmio previdenziale' },
    { href: '#regole',    label: 'Regole di categoria',   value: String(rules.length),                   sub: rules.length === 1 ? 'regola attiva' : 'regole attive' },
    { href: '#openai',    label: 'Import KID (OpenAI)',   value: hasKey ? 'Attivo' : 'Non configurato',  sub: hasKey ? 'chiave salvata' : 'serve una chiave API' },
    { href: '#banking',   label: 'Open Banking',          value: hasEbKey ? 'Attivo' : 'Non configurato', sub: hasEbKey ? 'chiave salvata' : 'serve una chiave Enable Banking' },
    { href: '#api',       label: 'Token API',             value: String(apiTokens.length),               sub: 'in sola lettura' },
  ]

  return (
    <main className={`${PAGE_SHELL} space-y-8`}>
      <PageHeader
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Impostazioni' }]}
        title="Impostazioni"
        description="Profilo fiscale, regole automatiche e collegamenti con i servizi esterni."
      />

      {/* ── Hero: cosa è configurato, a colpo d'occhio ────────────────────── */}
      <HeroShell>
        <div className="px-5 sm:px-6 pt-5 pb-4">
          <Eyebrow>Stato della configurazione</Eyebrow>
        </div>
        <div className="flex flex-wrap gap-px bg-(--border) border-t border-(--border)">
          {tiles.map((t) => (
            <a
              key={t.href}
              href={t.href}
              className="group flex-1 basis-[16rem] min-[131rem]:basis-0 min-w-0 flex flex-col gap-2 p-5 sm:p-6 bg-(--surface) hover:bg-(--surface-2) active:bg-(--surface-2) transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ring)"
            >
              <span className="text-xs font-medium text-(--muted)">{t.label}</span>
              <span className="text-2xl sm:text-3xl font-extrabold font-display tabular-nums leading-none tracking-[-0.02em] text-(--ink)">{t.value}</span>
              <span className="text-xs text-(--muted)">{t.sub}</span>
            </a>
          ))}
        </div>
      </HeroShell>

      {/* Due colonne bilanciate dal browser: ogni scheda resta intera */}
      <div className="xl:columns-2 gap-6 [&>*]:break-inside-avoid [&>*]:mb-6 [&>*]:scroll-mt-20">
      <Card id="fiscale">
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
      <Card id="regole">
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

      <Card id="openai">
        <CardHeader>
          <div>
            <CardTitle>Chiave API OpenAI</CardTitle>
            <CardDescription>
              Necessaria per importare i dati dai documenti KID (PDF). Ottienila da{' '}
              <span className="text-(--ink)">platform.openai.com/api-keys</span>.
            </CardDescription>
          </div>
        </CardHeader>
        <OpenAiKeyForm hasKey={hasKey} setAt={setAt} />
      </Card>

      <Card id="banking">
        <CardHeader>
          <div>
            <CardTitle>Open Banking (Enable Banking)</CardTitle>
            <CardDescription>
              Necessaria per collegare le tue banche e importare saldi e movimenti
              automaticamente. Il piano gratuito richiede un&apos;app registrata a testa.
            </CardDescription>
          </div>
        </CardHeader>
        <EnableBankingKeyForm
          hasKey={hasEbKey}
          setAt={ebSetAt}
          redirectUrl={ebRedirectUrl}
          privacyUrl={ebPrivacyUrl}
          termsUrl={ebTermsUrl}
        />
      </Card>

      <Card id="api">
        <CardHeader>
          <div>
            <CardTitle>Accesso API · Homepage</CardTitle>
            <CardDescription>
              Token in sola lettura per mostrare il tuo patrimonio nella dashboard
              self-hosted <span className="text-(--ink)">Homepage</span> (gethomepage.dev)
              o in qualunque altro strumento che sappia chiamare un&apos;API JSON.
            </CardDescription>
          </div>
        </CardHeader>
        <ApiTokensManager tokens={apiTokens} />
      </Card>

      {isAdmin && (
        <Card id="accessi">
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
      </div>
    </main>
  )
}
