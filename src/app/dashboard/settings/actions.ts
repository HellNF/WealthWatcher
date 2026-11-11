'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/dal'
import {
  setOpenAiKey, clearOpenAiKey, setUserProfile,
  setEnableBankingKey, clearEnableBankingKey,
} from '@/lib/userSettings'
import { addAllowedEmail, removeAllowedEmail, updateAllowedEmailRole, normalizeEmail } from '@/lib/users'
import { createCategoryRule, deleteCategoryRule, previewCategoryRule, type RuleDraft, type RulePreview } from '@/lib/merchants'
import { previewRecategorization, applyRecategorization } from '@/lib/categorization'
import { createApiToken, revokeApiToken, TooManyTokensError } from '@/lib/apiTokens'

type ActionState = { error?: string; success?: string } | undefined

const keySchema = z.string()
  .min(1, 'La chiave non può essere vuota')
  .startsWith('sk-', 'La chiave OpenAI deve iniziare con "sk-"')

export async function saveOpenAiKeyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const parse = keySchema.safeParse(formData.get('openai_key'))
  if (!parse.success) return { error: parse.error.issues[0].message }

  setOpenAiKey(user.id, parse.data)
  revalidatePath('/dashboard/settings', 'page')
  return { success: 'Chiave salvata' }
}

export async function removeOpenAiKeyAction(): Promise<ActionState> {
  const user = await requireUser()
  clearOpenAiKey(user.id)
  revalidatePath('/dashboard/settings', 'page')
  return { success: 'Chiave rimossa' }
}

// ── Enable Banking (Open Banking) — chiave app per-utente ─────────────────────
// Piano gratuito Enable Banking: un'app per account → ogni utente registra la
// propria su https://enablebanking.com e la incolla qui (mai condivisa).

const ebAppIdSchema = z.string().trim().min(1, 'App ID obbligatorio').max(200)

const ebPrivateKeySchema = z.string()
  .trim()
  .min(1, 'Chiave privata obbligatoria')
  .transform((v) => v.replace(/\\n/g, '\n')) // paste su una riga con "\n" letterali
  .refine((v) => v.includes('BEGIN') && v.includes('PRIVATE KEY'), {
    message: 'La chiave deve essere in formato PEM (-----BEGIN ... PRIVATE KEY-----)',
  })

export async function saveEnableBankingKeyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()
  const appIdParse = ebAppIdSchema.safeParse(formData.get('eb_app_id'))
  if (!appIdParse.success) return { error: appIdParse.error.issues[0].message }
  const keyParse = ebPrivateKeySchema.safeParse(formData.get('eb_private_key'))
  if (!keyParse.success) return { error: keyParse.error.issues[0].message }

  setEnableBankingKey(user.id, appIdParse.data, keyParse.data)
  revalidatePath('/dashboard/settings', 'page')
  return { success: 'Chiave Enable Banking salvata' }
}

export async function removeEnableBankingKeyAction(): Promise<ActionState> {
  const user = await requireUser()
  clearEnableBankingKey(user.id)
  revalidatePath('/dashboard/settings', 'page')
  return { success: 'Chiave rimossa' }
}

// ── Whitelist (solo admin) ────────────────────────────────────────────────────

const emailSchema = z.string().email('Email non valida').max(254)
const roleSchema  = z.enum(['admin', 'member'])

async function requireAdmin() {
  const user = await requireUser()
  if (user.role !== 'admin') throw new Error('Non autorizzato')
  return user
}

export async function addAllowedEmailAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin()
  const emailParse = emailSchema.safeParse(formData.get('email'))
  if (!emailParse.success) return { error: emailParse.error.issues[0].message }
  const roleParse = roleSchema.safeParse(formData.get('role') ?? 'member')
  if (!roleParse.success) return { error: 'Ruolo non valido' }

  addAllowedEmail(emailParse.data, roleParse.data)
  revalidatePath('/dashboard/settings', 'page')
  return { success: `${emailParse.data} aggiunta alla whitelist` }
}

export async function removeAllowedEmailAction(email: string): Promise<ActionState> {
  const user = await requireAdmin()
  if (normalizeEmail(email) === normalizeEmail(user.email ?? '')) {
    return { error: 'Non puoi rimuovere la tua stessa email' }
  }
  removeAllowedEmail(email)
  revalidatePath('/dashboard/settings', 'page')
}

export async function updateAllowedEmailRoleAction(email: string, role: string): Promise<ActionState> {
  const user = await requireAdmin()
  if (normalizeEmail(email) === normalizeEmail(user.email ?? '')) {
    return { error: 'Non puoi cambiare il tuo ruolo' }
  }
  const roleParse = roleSchema.safeParse(role)
  if (!roleParse.success) return { error: 'Ruolo non valido' }
  updateAllowedEmailRole(email, roleParse.data)
  revalidatePath('/dashboard/settings', 'page')
}

// ── Category rules ────────────────────────────────────────────────────────────

function parseAmountField(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? '').trim().replace(',', '.')
  if (!s) return null
  const n = parseFloat(s)
  if (isNaN(n) || n < 0) return null
  return Math.round(n * 100)  // convert € to minor units
}

function parseRuleDraft(formData: FormData): RuleDraft | { error: string } {
  const pattern    = String(formData.get('pattern') ?? '').trim().toLowerCase()
  const categoryId = parseInt(String(formData.get('category_id') ?? ''), 10)
  const amtMin     = parseAmountField(formData.get('amount_min'))
  const amtMax     = parseAmountField(formData.get('amount_max'))
  const accountRaw = String(formData.get('bank_account_id') ?? '')
  const accountId  = accountRaw ? parseInt(accountRaw, 10) : null
  const dirRaw     = String(formData.get('direction') ?? '')
  const direction  = dirRaw === 'in' || dirRaw === 'out' ? dirRaw : null

  if (!pattern)          return { error: 'Il pattern non può essere vuoto.' }
  if (isNaN(categoryId)) return { error: 'Seleziona una categoria.' }
  if (accountId !== null && !Number.isSafeInteger(accountId)) return { error: 'Conto non valido.' }
  if (amtMin !== null && amtMax !== null && amtMin > amtMax) {
    return { error: 'L\'importo minimo non può essere maggiore del massimo.' }
  }
  return { pattern, categoryId, amountMinorMin: amtMin, amountMinorMax: amtMax, bankAccountId: accountId, direction }
}

export async function createCategoryRuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user  = await requireUser()
  const draft = parseRuleDraft(formData)
  if ('error' in draft) return { error: draft.error }
  const result = createCategoryRule(user.id, draft)
  if (!result.ok) return { error: result.error }
  revalidatePath('/dashboard/settings', 'page')
  return { success: `Regola "${draft.pattern}" creata. Per applicarla ai movimenti già importati usa «Rivedi categorie dello storico».` }
}

/** Anteprima della regola sullo storico, senza salvarla. */
export async function previewCategoryRuleAction(formData: FormData): Promise<RulePreview | { error: string }> {
  const user  = await requireUser()
  const draft = parseRuleDraft(formData)
  if ('error' in draft) return draft
  return previewCategoryRule(user.id, draft)
}

export async function deleteCategoryRuleAction(id: number): Promise<void> {
  const user = await requireUser()
  deleteCategoryRule(id, user.id)
  revalidatePath('/dashboard/settings', 'page')
}

// ── Profilo fiscale ───────────────────────────────────────────────────────────

const VALID_RATES = ['0.23', '0.35', '0.43']

export async function saveFiscalProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user       = await requireUser()
  const rateRaw    = String(formData.get('irpef_marginal_rate') ?? '').trim()
  const marginalRate = rateRaw === '' ? null : parseFloat(rateRaw.replace(',', '.'))

  if (rateRaw !== '' && (isNaN(marginalRate!) || !VALID_RATES.includes(rateRaw.replace(',', '.')))) {
    return { error: 'Seleziona un\'aliquota valida (23%, 35% o 43%).' }
  }

  setUserProfile(user.id, { irpefMarginalRate: marginalRate })
  revalidatePath('/dashboard/settings', 'page')
  revalidatePath('/dashboard/tasse', 'page')
  return { success: 'Profilo fiscale salvato.' }
}

// ── Token API (Homepage / accesso M2M) ───────────────────────────────────────

export type ApiTokenState = { error?: string; success?: string; token?: string } | undefined

const tokenNameSchema = z.string().trim().min(1, 'Dai un nome al token').max(100)

export async function createApiTokenAction(
  _prev: ApiTokenState,
  formData: FormData,
): Promise<ApiTokenState> {
  const user = await requireUser()
  const parse = tokenNameSchema.safeParse(formData.get('name'))
  if (!parse.success) return { error: parse.error.issues[0].message }

  try {
    const { token } = createApiToken(user.id, parse.data)
    revalidatePath('/dashboard/settings', 'page')
    return { success: 'Token creato — copialo ora, non sarà più mostrato.', token }
  } catch (e) {
    if (e instanceof TooManyTokensError) return { error: e.message }
    throw e
  }
}

export async function revokeApiTokenAction(id: number): Promise<void> {
  const user = await requireUser()
  revokeApiToken(user.id, id)
  revalidatePath('/dashboard/settings', 'page')
}

export async function previewCategoriesAction() {
  const user = await requireUser()
  const proposals = previewRecategorization(user.id)
  return { proposals: proposals.slice(0, 500), total: proposals.length }
}

export async function applyCategoriesAction(selection: { id: number; fingerprint: string }[]) {
  const user = await requireUser()
  if (!Array.isArray(selection) || selection.length > 500 || selection.some(p =>
    !p || !Number.isSafeInteger(p.id) || typeof p.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(p.fingerprint))) {
    throw new Error('Selezione non valida')
  }
  const result = applyRecategorization(user.id, selection)
  revalidatePath('/dashboard', 'layout')
  return result
}
