// src/__tests__/lib/uploads.test.ts
import { assertUploadOk, UploadValidationError, IMPORT_STATEMENT_UPLOAD, KID_PDF_UPLOAD } from '@/lib/uploads'

function fakeFile(name: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name)
}

test('accetta un file entro i limiti e con estensione valida', () => {
  const file = fakeFile('estratto.xlsx', 1024)
  expect(() => assertUploadOk(file, IMPORT_STATEMENT_UPLOAD)).not.toThrow()
})

test('rifiuta un file oltre la dimensione massima', () => {
  const file = fakeFile('estratto.csv', IMPORT_STATEMENT_UPLOAD.maxBytes + 1)
  expect(() => assertUploadOk(file, IMPORT_STATEMENT_UPLOAD)).toThrow(UploadValidationError)
})

test('rifiuta un\'estensione non supportata', () => {
  const file = fakeFile('estratto.exe', 1024)
  expect(() => assertUploadOk(file, IMPORT_STATEMENT_UPLOAD)).toThrow(UploadValidationError)
})

test('KID_PDF_UPLOAD accetta solo .pdf', () => {
  expect(() => assertUploadOk(fakeFile('kid.pdf', 1024), KID_PDF_UPLOAD)).not.toThrow()
  expect(() => assertUploadOk(fakeFile('kid.docx', 1024), KID_PDF_UPLOAD)).toThrow(UploadValidationError)
})

test('il confronto sull\'estensione ignora maiuscole/minuscole', () => {
  expect(() => assertUploadOk(fakeFile('KID.PDF', 1024), KID_PDF_UPLOAD)).not.toThrow()
})
