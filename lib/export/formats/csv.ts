// lib/export/formats/csv.ts
import type { ExportPayload } from '../types'

export const CSV_HEADER = ['Date', 'Category', 'Amount', 'Description'] as const

// Leading BOM makes Excel open the file as UTF-8 instead of the system codepage.
const BOM = '﻿'

export function escapeCSVField(value: string): string {
  // Neutralize spreadsheet formula injection (=, +, -, @ at the start of a cell).
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCSV({ expenses }: ExportPayload): string {
  const rows = expenses.map((e) =>
    [e.date, e.category, e.amount.toFixed(2), escapeCSVField(e.description)].join(','),
  )
  // RFC 4180 specifies CRLF line endings.
  return [CSV_HEADER.join(','), ...rows].join('\r\n')
}

export async function serializeCSV(payload: ExportPayload): Promise<Blob> {
  return new Blob([BOM + toCSV(payload)], { type: 'text/csv;charset=utf-8' })
}
