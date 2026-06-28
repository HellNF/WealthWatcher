'use client'
import { useActionState } from 'react'
import { addInstitution, type ActionState } from './actions'

export default function AddInstitutionForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addInstitution,
    undefined,
  )

  return (
    <form action={action} className="flex flex-col sm:flex-row gap-2 sm:items-center">
      <input
        name="name"
        required
        placeholder="Nome istituzione (es. Intesa San Paolo)"
        className="flex-1 rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 outline-none"
      />
      <select
        name="kind"
        defaultValue="bank"
        className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 outline-none"
      >
        <option value="bank">Banca</option>
        <option value="broker">Broker</option>
        <option value="both">Entrambi</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-emerald-500 text-zinc-950 font-medium px-4 py-2 text-sm hover:bg-emerald-400 disabled:opacity-50 transition"
      >
        {pending ? 'Aggiungo…' : 'Aggiungi'}
      </button>
      {state?.error && <span className="text-sm text-red-400">{state.error}</span>}
    </form>
  )
}
