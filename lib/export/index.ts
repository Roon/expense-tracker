// lib/export/index.ts
import type { Expense } from '@/lib/types'
import { applyExportFilters, summarizeExpenses } from './filters'
import { buildFilename } from './filename'
import { serializeCSV } from './formats/csv'
import { serializeJSON } from './formats/json'
import { serializePDF } from './formats/pdf'
import type { ExportFormat, ExportFormatDefinition, ExportOptions } from './types'

export const EXPORT_FORMATS: Record<ExportFormat, ExportFormatDefinition> = {
  csv: {
    id: 'csv',
    label: 'CSV',
    description: 'Spreadsheet-ready. Opens in Excel, Numbers, Sheets.',
    extension: 'csv',
    mimeType: 'text/csv',
    serialize: serializeCSV,
  },
  json: {
    id: 'json',
    label: 'JSON',
    description: 'Structured data with summary, for developers and backups.',
    extension: 'json',
    mimeType: 'application/json',
    serialize: serializeJSON,
  },
  pdf: {
    id: 'pdf',
    label: 'PDF',
    description: 'Formatted report with totals, ready to print or share.',
    extension: 'pdf',
    mimeType: 'application/pdf',
    serialize: serializePDF,
  },
}

export interface ExportResult {
  blob: Blob
  filename: string
  count: number
}

/** Filters, summarizes and serializes expenses according to `options`. */
export async function exportExpenses(
  expenses: Expense[],
  options: ExportOptions,
  now: Date = new Date(),
): Promise<ExportResult> {
  const definition = EXPORT_FORMATS[options.format]
  const selected = applyExportFilters(expenses, options.filters)
  const blob = await definition.serialize({
    expenses: selected,
    summary: summarizeExpenses(selected),
    filters: options.filters,
    generatedAt: now,
  })
  return { blob, filename: buildFilename(options.filename, definition.extension, now), count: selected.length }
}

export * from './types'
export * from './filters'
export * from './filename'
export { downloadBlob } from './download'
