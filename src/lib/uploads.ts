// src/lib/uploads.ts
//
// Limiti di dimensione/estensione per i file caricati dagli utenti (import
// estratti conto, PDF KID). Prima di questi controlli l'unico check era
// `file.size === 0` — un file enorme veniva comunque bufferizzato e passato
// al parser (XLSX/CSV/PDF), rischio di DoS con la memoria del processo.
//
// L'estensione dichiarata dal client non è una prova crittografica del tipo
// reale del file, ma resta un filtro utile in combinazione con: (1) il limite
// di dimensione qui sotto, (2) i parser stessi, che comunque validano la
// struttura e falliscono su contenuti inattesi senza eseguirli.
export interface UploadRule {
  maxBytes:   number
  extensions: string[] // lowercase, con punto iniziale — es. ['.csv', '.xlsx']
}

export class UploadValidationError extends Error {}

export function assertUploadOk(file: File, rule: UploadRule): void {
  if (file.size > rule.maxBytes) {
    const maxMb = (rule.maxBytes / (1024 * 1024)).toFixed(1)
    throw new UploadValidationError(`File troppo grande (max ${maxMb} MB)`)
  }
  const name = file.name.toLowerCase()
  const allowed = rule.extensions.some((ext) => name.endsWith(ext))
  if (!allowed) {
    throw new UploadValidationError(`Formato file non supportato (atteso: ${rule.extensions.join(', ')})`)
  }
}

/** Estratti conto (Intesa/BBVA in Excel, Revolut in CSV) — vedi src/lib/import/registry.ts. */
export const IMPORT_STATEMENT_UPLOAD: UploadRule = {
  maxBytes:   5 * 1024 * 1024, // 5 MB — ben oltre un estratto conto reale
  extensions: ['.csv', '.xlsx', '.xls'],
}

/** Documento KID (PDF) per l'estrazione dati tramite LLM. */
export const KID_PDF_UPLOAD: UploadRule = {
  maxBytes:   10 * 1024 * 1024, // 10 MB
  extensions: ['.pdf'],
}
