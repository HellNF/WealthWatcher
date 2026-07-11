'use client'

import { useActionState } from 'react'
import { saveEnableBankingKeyAction, removeEnableBankingKeyAction } from './actions'
import { Button, Field, Input, Textarea } from '@/components/ui'

type Props = {
  hasKey:      boolean
  setAt:       number | null
  redirectUrl: string
  privacyUrl:  string
  termsUrl:    string
}
type State = { error?: string; success?: string } | undefined

function UrlBlock({ value }: { value: string }) {
  return (
    <code className="block mt-1 px-2.5 py-1.5 rounded-md bg-[--surface-2] text-[--ink] text-xs break-all select-all">
      {value}
    </code>
  )
}

export default function EnableBankingKeyForm({ hasKey, setAt, redirectUrl, privacyUrl, termsUrl }: Props) {
  const [saveState, saveAction, savePending]     = useActionState<State, FormData>(saveEnableBankingKeyAction, undefined)
  const [removeState, removeAction, removePending] = useActionState<State, FormData>(removeEnableBankingKeyAction, undefined)

  const setAtLabel = setAt
    ? new Date(setAt * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <div className="space-y-5">
      {/* Istruzioni di registrazione */}
      <div className="space-y-2.5 text-sm text-[--muted] leading-relaxed">
        <p>
          Il piano gratuito di Enable Banking richiede un&apos;app registrata per ogni account:
          questi passaggi vanno fatti una sola volta, con la tua email.
        </p>
        <ol className="list-decimal list-inside space-y-2 marker:text-[--faint]">
          <li>
            Crea un account su{' '}
            <a href="https://enablebanking.com" target="_blank" rel="noopener noreferrer" className="text-[--brand-text] hover:underline">
              enablebanking.com
            </a>.
          </li>
          <li>
            Nel Control Panel, apri{' '}
            <a href="https://enablebanking.com/cp/applications" target="_blank" rel="noopener noreferrer" className="text-[--brand-text] hover:underline">
              API applications
            </a>{' '}
            e scegli &quot;Register new application&quot;.
          </li>
          <li>
            Scegli l&apos;ambiente <strong className="text-[--ink]">Production</strong> (non serve un
            contratto/verifica aziendale se colleghi solo i tuoi conti — vedi passo 6) e lascia
            l&apos;opzione predefinita per la creazione della chiave privata.
          </li>
          <li>
            Compila il resto del form:
            <ul className="list-disc list-inside mt-1.5 space-y-2 pl-2">
              <li>Nome e descrizione dell&apos;applicazione: a tua scelta (es. &quot;WealthWatcher&quot;).</li>
              <li>
                URL di redirect autorizzati:
                <UrlBlock value={redirectUrl} />
              </li>
              <li>
                Privacy URL:
                <UrlBlock value={privacyUrl} />
              </li>
              <li>
                Terms URL:
                <UrlBlock value={termsUrl} />
              </li>
            </ul>
          </li>
          <li>
            Premi &quot;Register&quot;: il browser scarica automaticamente un file <code className="text-xs">.pem</code>{' '}
            (la tua chiave privata) e mostra l&apos;App ID nella pagina.
          </li>
          <li>
            <strong className="text-[--ink]">Prima di tornare qui</strong>: nel Control Panel vai su
            &quot;Link account&quot; e collega/autorizza i tuoi conti bancari personali. È questo
            passaggio — non un &quot;Activate&quot; — ad abilitare l&apos;uso in Production limitato ai
            tuoi conti, senza contratto aziendale.
          </li>
          <li>Copia App ID e l&apos;intero contenuto del file <code className="text-xs">.pem</code> nei campi qui sotto e salva.</li>
          <li>Torna sulla pagina della banca in WealthWatcher e usa &quot;Collega banca&quot; per autorizzare l&apos;accesso.</li>
        </ol>
      </div>

      {/* Stato chiave */}
      <div className="flex items-center gap-2 text-sm">
        <span
          className={[
            'size-2 rounded-full shrink-0',
            hasKey ? 'bg-[--brand]' : 'bg-[--faint]',
          ].join(' ')}
        />
        <span className="text-[--muted]">
          {hasKey
            ? `Chiave impostata${setAtLabel ? ` il ${setAtLabel}` : ''}`
            : 'Nessuna chiave impostata'}
        </span>
      </div>

      {/* Form salvataggio */}
      <form action={saveAction} className="space-y-3">
        <Field label="App ID" htmlFor="eb-app-id">
          <Input
            id="eb-app-id"
            name="eb_app_id"
            placeholder="es. 3f7a2c1e-…"
            autoComplete="off"
            required
          />
        </Field>
        <Field label="Chiave privata (PEM)" htmlFor="eb-private-key" hint="Incolla l'intero contenuto del file .pem scaricato al passo 5.">
          <Textarea
            id="eb-private-key"
            name="eb_private_key"
            placeholder="-----BEGIN PRIVATE KEY-----&#10;…&#10;-----END PRIVATE KEY-----"
            autoComplete="off"
            required
            className="font-mono text-xs min-h-[120px]"
          />
        </Field>
        <Button type="submit" disabled={savePending} loading={savePending}>
          Salva
        </Button>
      </form>

      {saveState?.error   && <p className="text-xs text-[--danger]" role="alert">{saveState.error}</p>}
      {saveState?.success && <p className="text-xs text-[--brand]">{saveState.success}</p>}

      {/* Rimozione */}
      {hasKey && (
        <form action={removeAction}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={removePending}
            loading={removePending}
          >
            Rimuovi chiave
          </Button>
          {removeState?.error   && <p className="text-xs text-[--danger] mt-1" role="alert">{removeState.error}</p>}
          {removeState?.success && <p className="text-xs text-[--brand] mt-1">{removeState.success}</p>}
        </form>
      )}

      <p className="text-xs text-[--faint] leading-relaxed max-w-prose">
        La chiave privata è cifrata (AES-256-GCM) nel database e viene usata solo per firmare le
        richieste verso Enable Banking quando colleghi una tua banca. Ogni utente registra e usa
        la propria app: nessuna chiave è condivisa fra account.
      </p>
    </div>
  )
}
