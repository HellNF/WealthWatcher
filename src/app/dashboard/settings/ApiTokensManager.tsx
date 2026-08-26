'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { createApiTokenAction, revokeApiTokenAction } from './actions'
import {
  Button, Input, TableWrapper, Table, TableHead, TableBody, Th, Tr, Td, Badge, ConfirmDelete,
} from '@/components/ui'
import { formatDateIt } from '@/lib/formatDate'
import { KeyRound, Copy, Check } from 'lucide-react'

export interface ApiTokenRow {
  id:            number
  name:          string
  prefix:        string
  created_at:    number
  last_used_at:  number | null
  revoked_at:    number | null
}

interface Props {
  tokens: ApiTokenRow[]
}

function TokenRow({ t }: { t: ApiTokenRow }) {
  const revoked = t.revoked_at !== null

  return (
    <Tr className={revoked ? 'opacity-50' : undefined}>
      <Td>{t.name}</Td>
      <Td>
        <code className="text-xs bg-[--surface-2] border border-[--border] rounded px-1.5 py-0.5 text-[--ink] font-mono">
          {t.prefix}…
        </code>
      </Td>
      <Td className="text-xs text-[--muted]">
        {formatDateIt(t.created_at, { day: '2-digit', month: 'short', year: 'numeric' })}
      </Td>
      <Td className="text-xs text-[--muted]">
        {t.last_used_at
          ? formatDateIt(t.last_used_at, { day: '2-digit', month: 'short', year: 'numeric' })
          : 'Mai usato'}
      </Td>
      <Td>
        {revoked ? (
          <Badge variant="neutral">Revocato</Badge>
        ) : (
          <ConfirmDelete
            action={() => revokeApiTokenAction(t.id)}
            label="Revoca"
            confirmText="Revocare questo token? Chi lo usa perderà l'accesso subito."
          />
        )}
      </Td>
    </Tr>
  )
}

function NewTokenReveal({ token, onDismiss }: { token: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard non disponibile (es. contesto non sicuro) — l'utente copia a mano
    }
  }

  return (
    <div className="rounded-xl border border-[--brand]/40 bg-[--brand-subtle] p-4 space-y-3">
      <p className="text-sm font-medium text-[--ink]">
        Token creato — copialo ora, non sarà più mostrato.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 min-w-0 truncate text-xs bg-[--surface] border border-[--border] rounded-lg px-3 py-2 text-[--ink] font-mono">
          {token}
        </code>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copiato' : 'Copia'}
        </Button>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
        Fatto
      </Button>
    </div>
  )
}

export default function ApiTokensManager({ tokens }: Props) {
  const [createState, createAction, isCreating] = useActionState(createApiTokenAction, undefined)
  const [dismissed, setDismissed] = useState(false)

  const showReveal = createState?.token && !dismissed

  return (
    <div className="space-y-4">
      {tokens.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-[--border] p-4 text-[--muted]">
          <KeyRound className="size-4 shrink-0" />
          <p className="text-sm">Nessun token ancora. Creane uno qui sotto per collegare Homepage.</p>
        </div>
      ) : (
        <TableWrapper className="rounded-xl border border-[--border] overflow-hidden">
          <Table>
            <TableHead>
              <Tr>
                <Th>Nome</Th>
                <Th>Token</Th>
                <Th>Creato</Th>
                <Th>Ultimo uso</Th>
                <Th />
              </Tr>
            </TableHead>
            <TableBody>
              {tokens.map((t) => <TokenRow key={t.id} t={t} />)}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      {showReveal && (
        <NewTokenReveal token={createState!.token!} onDismiss={() => setDismissed(true)} />
      )}

      <form
        action={(fd) => { setDismissed(false); createAction(fd) }}
        className="flex items-end gap-2"
      >
        <div className="flex-1 min-w-40">
          <label htmlFor="token-name" className="text-xs font-medium text-[--muted]">
            Nome del token
          </label>
          <Input
            id="token-name"
            name="name"
            type="text"
            placeholder="es. Homepage salotto"
            required
            className="mt-1"
          />
        </div>
        <Button type="submit" disabled={isCreating} loading={isCreating}>
          Genera token
        </Button>
      </form>

      {createState?.error && <p className="text-xs text-[--danger]" role="alert">{createState.error}</p>}

      <p className="text-xs text-[--faint] leading-relaxed max-w-prose">
        Il token dà accesso in sola lettura al tuo patrimonio via API — trattalo come una
        password. Usalo solo su reti fidate (es. la tua LAN/VPN) e revocalo se sospetti
        che sia stato esposto. Vedi{' '}
        <span className="text-[--ink]">docs/homepage-integration.md</span> per la guida
        completa e lo <code className="text-[--ink]">services.yaml</code> da incollare in Homepage.
      </p>
    </div>
  )
}
