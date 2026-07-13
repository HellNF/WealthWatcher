'use client'

import { useActionState, useTransition } from 'react'
import { addAllowedEmailAction, removeAllowedEmailAction, updateAllowedEmailRoleAction } from './actions'
import { Button, TableWrapper, Table, TableHead, TableBody, Th, Tr, Td, Badge } from '@/components/ui'
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

function fmtDate(epoch: number): string {
  return formatDateIt(epoch)
}

function EmailRow({ entry, isSelf }: { entry: AllowedEntry; isSelf: boolean }) {
  const [, startTransition] = useTransition()

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value
    startTransition(async () => { await updateAllowedEmailRoleAction(entry.email, role) })
  }

  function handleRemove() {
    if (!confirm(`Rimuovere ${entry.email} dalla whitelist?`)) return
    startTransition(async () => { await removeAllowedEmailAction(entry.email) })
  }

  return (
    <Tr>
      <Td>
        <span className="text-sm text-[--ink] font-medium">{entry.email}</span>
        {isSelf && <span className="ml-2 text-xs text-[--muted]">(tu)</span>}
      </Td>
      <Td>
        {isSelf ? (
          <Badge variant={entry.role === 'admin' ? 'gain' : 'neutral'}>{entry.role}</Badge>
        ) : (
          <select
            defaultValue={entry.role}
            onChange={handleRoleChange}
            className="text-xs rounded-lg border border-[--border] bg-[--surface-2] text-[--ink] px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[--ring]"
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        )}
      </Td>
      <Td>
        <span className="text-xs text-[--muted]">{fmtDate(entry.created_at)}</span>
      </Td>
      <Td>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          disabled={isSelf}
          title={isSelf ? 'Non puoi rimuovere te stesso' : `Rimuovi ${entry.email}`}
          className="text-[--danger] hover:bg-[--danger-subtle] disabled:opacity-30"
        >
          <Trash2 className="size-3.5" />
        </Button>
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
        <TableWrapper className="rounded-xl border border-[--border] overflow-hidden">
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
        <p className="text-sm text-[--muted]">Nessuna email in whitelist.</p>
      )}

      {/* Form aggiunta */}
      <form action={formAction} className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-52 space-y-1">
          <label className="text-xs font-medium text-[--muted]">Nuova email</label>
          <input
            name="email"
            type="email"
            required
            placeholder="utente@esempio.com"
            className="w-full h-9 rounded-lg border border-[--border] bg-[--surface-2] px-3 text-sm text-[--ink] placeholder:text-[--faint] focus:outline-none focus:ring-2 focus:ring-[--ring] focus:border-[--brand] transition-colors duration-150"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-[--muted]">Ruolo</label>
          <select
            name="role"
            defaultValue="member"
            className="h-9 rounded-lg border border-[--border] bg-[--surface-2] text-[--ink] px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[--ring]"
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <Button type="submit" variant="primary" size="sm" loading={isPending} disabled={isPending}>
          <UserPlus className="size-3.5" />
          Aggiungi
        </Button>
      </form>

      {state?.error && (
        <p className="text-sm text-[--danger]">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-[--brand-text]">{state.success}</p>
      )}
    </div>
  )
}
