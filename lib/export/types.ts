// lib/export/types.ts
import type { Category, Expense } from '@/lib/types'

export type ExportFormat = 'csv' | 'json' | 'pdf'

export interface ExportFilters {
  /** Inclusive lower bound, YYYY-MM-DD. Empty string means unbounded. */
  startDate: string
  /** Inclusive upper bound, YYYY-MM-DD. Empty string means unbounded. */
  endDate: string
  categories: Category[]
}

export interface ExportOptions {
  format: ExportFormat
  filters: ExportFilters
  /** Filename without extension, as typed by the user. */
  filename: string
}

export interface ExportSummary {
  count: number
  total: number
  /** Earliest and latest expense dates actually present, YYYY-MM-DD. */
  firstDate: string | null
  lastDate: string | null
  byCategory: Partial<Record<Category, { count: number; total: number }>>
}

/** Everything a format serializer needs to render a document. */
export interface ExportPayload {
  expenses: Expense[]
  summary: ExportSummary
  filters: ExportFilters
  generatedAt: Date
}

export interface ExportFormatDefinition {
  id: ExportFormat
  label: string
  description: string
  extension: string
  mimeType: string
  serialize: (payload: ExportPayload) => Promise<Blob>
}
