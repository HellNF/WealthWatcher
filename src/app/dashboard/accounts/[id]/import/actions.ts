'use server'
import { requireUser } from '@/lib/dal'
import { getAccountForUser } from '@/lib/accounts'
import { getInstitutionForUser } from '@/lib/institutions'
import { providerParser } from '@/lib/providers'
import { PARSERS } from '@/lib/import/registry'
import { normalizeDescription, resolveMerchant, resolveCategoryRule, resolveIntesaCategory } from '@/lib/merchants'
import { previewRows, insertBatch, type InsertableTransaction, type PreviewRow } from '@/lib/transactions'
import { refreshNetWorth } from '@/lib/valuation'

// ── Shared: parse XLSX + resolve merchants ────────────────────────────────────
// Il parser è scelto dal provider dell'istituzione del conto. Se il provider non
// ha un parser (banca personalizzata o non ancora supportata), l'import è negato.

async function parsedRowsForAccount(userId: number, accountId: number, file: File) {
  const account = getAccountForUser(userId, accountId)
  if (!account) throw new Error('Conto non trovato o non autorizzato')

  const institution = getInstitutionForUser(userId, account.institution_id)
  const parserKey = providerParser(institution?.provider)
  if (!parserKey) {
    throw new Error(
      'Import dell\'estratto conto non supportato per questa banca. ' +
      'Puoi inserire i movimenti manualmente.',
    )
  }
  const parse = PARSERS[parserKey]

  const buffer = Buffer.from(await file.arrayBuffer())
  const parsed = parse(buffer)

  const rows: InsertableTransaction[] = parsed.map((p) => {
    const normalized   = normalizeDescription(p.descriptionRaw + ' ' + p.counterpartyRaw)
    const ruleCategory = resolveCategoryRule(normalized, userId, Math.abs(p.amountMinor))
    const merchant    = resolveMerchant(normalized)

    // Priority: user rule → merchant alias → bank-provided category
    const categoryId = ruleCategory ?? merchant?.categoryId ?? resolveIntesaCategory(p.intesaCategory)

    return {
      owner_id:         userId,
      bank_account_id:  accountId,
      booked_date:      p.bookedDate,
      value_date:       p.valueDate ?? null,
      amount_minor:     p.amountMinor,
      currency:         p.currency,
      description_raw:  p.descriptionRaw,
      counterparty_raw: p.counterpartyRaw,
      dedup_hash:       p.dedupHash,
      merchant_id:      merchant?.merchantId ?? null,
      category_id:      categoryId,
    }
  })

  return { account, rows, parserKey }
}

// ── Preview (no writes) ───────────────────────────────────────────────────────

export interface PreviewResult {
  rows:           PreviewRow[]
  newCount:       number
  duplicateCount: number
  suspectCount:   number
  filename:       string
  error?:         string
}

export async function previewImportAction(formData: FormData): Promise<PreviewResult> {
  const user = await requireUser()
  const accountId = parseInt(String(formData.get('accountId')), 10)
  const file = formData.get('file') as File | null

  if (!file || file.size === 0) {
    return { rows: [], newCount: 0, duplicateCount: 0, suspectCount: 0, filename: '', error: 'Nessun file selezionato' }
  }

  try {
    const { rows } = await parsedRowsForAccount(user.id, accountId, file)
    const preview = previewRows(accountId, rows)

    return {
      rows:           preview,
      newCount:       preview.filter((r) => r.status === 'new').length,
      duplicateCount: preview.filter((r) => r.status === 'duplicate').length,
      suspectCount:   preview.filter((r) => r.status === 'suspect').length,
      filename:       file.name,
    }
  } catch (err) {
    return {
      rows:           [],
      newCount:       0,
      duplicateCount: 0,
      suspectCount:   0,
      filename:       file.name,
      error:          err instanceof Error ? err.message : 'Errore durante il parsing',
    }
  }
}

// ── Commit (write to DB) ──────────────────────────────────────────────────────

export interface CommitResult {
  insertedCount:  number
  duplicateCount: number
  filename:       string
  error?:         string
}

export async function commitImportAction(formData: FormData): Promise<CommitResult> {
  const user = await requireUser()
  const accountId = parseInt(String(formData.get('accountId')), 10)
  const file = formData.get('file') as File | null

  if (!file || file.size === 0) {
    return { insertedCount: 0, duplicateCount: 0, filename: '', error: 'Nessun file' }
  }

  try {
    const { rows, parserKey } = await parsedRowsForAccount(user.id, accountId, file)

    const result = insertBatch({
      ownerId:       user.id,
      bankAccountId: accountId,
      source:        parserKey,
      filename:      file.name,
      rows,
    })
    await refreshNetWorth(user.id)

    return {
      insertedCount:  result.insertedCount,
      duplicateCount: result.duplicateCount,
      filename:       file.name,
    }
  } catch (err) {
    return {
      insertedCount:  0,
      duplicateCount: 0,
      filename:       file?.name ?? '',
      error:          err instanceof Error ? err.message : 'Errore durante l\'importazione',
    }
  }
}
