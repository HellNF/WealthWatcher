'use client'

import { useActionState, useTransition } from 'react'
import { addAllowedEmailAction, removeAllowedEmailAction, updateAllowedEmailRoleAction } from './actions'
import { Button, TableWrapper, Table, TableHead, TableBody, Th, Tr, Td, Badge, Select, Tooltip, ConfirmDialog } from '@/components/ui'
import { UserPlus, Trash2 } from 'lucide-react'
import { formatDateIt } from '@/lib/formatDate'

interface AllowedEntry {
  email:      string
  role:       'admin' | 'member'
  created_at: number
}

interface Props {
  entries:    AllowedEntry[]
  currentEmail: string | null
}

const ROLE_OPTIONS = [
  { value: 'member', label: 'Membro' },
  { value: 'admin',  label: 'Amministratore' },
]

function fmtDate(epoch: number): string {
  return formatDateIt(epoch)
}

function EmailRow({ entry, isSelf }: { entry: AllowedEntry; isSelf: boolean }) {
  const [, startTransition] = useTransition()

  function handleRoleChange(role: string) {
    startTransition(async () => { await updateAllowedEmailRoleAction(entry.email, role) })
  }

  return (
    <Tr>
      <Td className="whitespace-normal">
        <span className="text-sm text-(--ink) font-medium break-all">{entry.email}</span>
        {isSelf && <span className="ml-2 text-xs text-(--muted)">(tu)</span>}
      </Td>
      <Td>
        {isSelf ? (
          <Badge variant="neutral">{ROLE_OPTIONS.find((r) => r.value === entry.role)?.label ?? entry.role}</Badge>
        ) : (
          <Select
            size="sm"
            className="w-auto"
            aria-label={`Ruolo di ${entry.email}`}
            defaultValue={entry.role}
            onValueChange={handleRoleChange}
            options={ROLE_OPTIONS}
          />
        )}
      </Td>
      <Td>
        <span className="text-xs text-(--muted)">{fmtDate(entry.created_at)}</span>
      </Td>
      <Td>
        {isSelf ? (
          <Tooltip content="Non puoi rimuovere te stesso">
            <span tabIndex={0} className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-(--ring)">
              <Button variant="ghost" size="sm" disabled aria-label="Rimuovi (non disponibile per il tuo account)" className="disabled:opacity-30">
                <Trash2 className="size-3.5" />
              </Button>
            </span>
          </Tooltip>
        ) : (
          <ConfirmDialog
            title={`Rimuovere ${entry.email}?`}
            description="Non potrà più accedere a WealthWatcher finché non la aggiungi di nuovo."
            confirmLabel="Rimuovi"
            onConfirm={() => removeAllowedEmailAction(entry.email)}
            trigger={
              <Button variant="ghost" size="sm" aria-label={`Rimuovi ${entry.email}`} className="hover:text-(--danger-text) hover:bg-(--danger-subtle)">
                <Trash2 className="size-3.5" />
              </Button>
            }
          />
        )}
      </Td>
    </Tr>
  )
}

export default function AllowlistManager({ entries, currentEmail }: Props) {
  const [state, formAction, isPending] = useActionState(addAllowedEmailAction, undefined)

  return (
    <div className="space-y-6">
      {/* Tabella email correnti */}
      {entries.length > 0 ? (
        <TableWrapper className="rounded-xl border border-(--border) overflow-hidden">
          <Table>
            <TableHead>
              <Tr>
                <Th>Email</Th>
                <Th>Ruolo</Th>
                <Th>Aggiunta il</Th>
                <Th />
              </Tr>
            </TableHead>
            <TableBody>
              {entries.map((e) => (
                <EmailRow
                  key={e.email}
                  entry={e}
                  isSelf={e.email === currentEmail}
                />
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      ) : (
        <p className="text-sm text-(--muted)">Nessuna email in whitelist.</p>
      )}

      {/* Form aggiunta */}
      <form action={formAction} className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-52 space-y-1">
          <label className="text-xs font-medium text-(--muted)">Nuova email</label>
          <input
            name="email"
            type="email"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="utente@esempio.com"
            className="w-full h-9 rounded-lg border border-(--border) bg-(--surface-2) px-3 text-sm text-(--ink) placeholder:text-(--faint) focus:outline-none focus:ring-2 focus:ring-(--ring) focus:border-(--brand) transition-colors duration-150"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="new-role" className="block text-xs font-medium text-(--muted)">Ruolo</label>
          <Select id="new-role" name="role" defaultValue="member" className="w-auto min-w-36" options={ROLE_OPTIONS} />
        </div>
        <Button type="submit" variant="primary" size="sm" loading={isPending} disabled={isPending}>
          <UserPlus className="size-3.5" />
          Aggiungi
        </Button>
      </form>

      {state?.error && (
        <p className="text-sm text-(--danger)">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-(--brand-text)">{state.success}</p>
      )}
    </div>
  )
}
