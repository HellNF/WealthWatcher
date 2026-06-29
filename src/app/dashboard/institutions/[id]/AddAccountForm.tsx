'use client'
import { useActionState } from 'react'
import { addAccount, type ActionState } from './actions'

export default function AddAccountForm({ institutionId }: { institutionId: number }) {
  const boundAction = addAccount.bind(null, institutionId)
  const [state, action, pending] = useActionState<ActionState, FormData>(boundAction, undefined)

  return (
    <form action={action} className="flex flex-col sm:flex-row gap-2 sm:items-center">
      <input
        name="name"
        required
        placeholder="Nome conto (es. Conto corrente)"
        className="flex-1 rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
      />
      <select
        name="currency"
        defaultValue="EUR"
        className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 outline-none"
      >
        <option value="EUR">EUR</option>
        <option value="USD">USD</option>
        <option value="GBP">GBP</option>
        <option value="CHF">CHF</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-500 text-zinc-950 font-medium px-4 py-2 text-sm hover:bg-emerald-400 disabled:opacity-50 transition"
      >
        {pending ? 'Aggiungo…' : 'Aggiungi conto'}
      </button>
      {state?.error && <span className="text-sm text-red-400">{state.error}</span>}
    </form>
  )
}
