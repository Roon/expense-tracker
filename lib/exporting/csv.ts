// lib/exporting/csv.ts
import type { Serializer } from './types'

/** One CSV column: a header and how to read its value from an item. */
export interface CsvColumn<T> {
  header: string
  value: (item: T) => string
}

export function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Generic CSV encoder. Every cell goes through escapeCsvField, so a column
 * can never forget to escape (the bug class behind the old date-field issue).
 */
export function createCsvSerializer<T>(columns: readonly CsvColumn<T>[]): Serializer<T> {
  const line = (cells: string[]) => cells.map(escapeCsvField).join(',')
  return {
    mimeType: 'text/csv;charset=utf-8;',
    serialize: (items) =>
      [line(columns.map((c) => c.header)), ...items.map((item) => line(columns.map((c) => c.value(item))))].join('\n'),
  }
}
