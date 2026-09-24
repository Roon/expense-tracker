// lib/exporting/index.ts
//
// Composition root: the only place that picks concrete implementations.
import type { Expense } from '@/lib/types'
import { browserFileSaver } from './browserFileSaver'
import { createCsvSerializer } from './csv'
import { EXPENSE_CSV_COLUMNS } from './expenseColumns'
import { createExporter } from './exporter'
import type { Exporter, FileSaver } from './types'

export const expenseCsvSerializer = createCsvSerializer(EXPENSE_CSV_COLUMNS)

export function createExpenseCsvExporter(
  filename = 'expenses.csv',
  saver: FileSaver = browserFileSaver,
): Exporter<Expense> {
  return createExporter({ serializer: expenseCsvSerializer, saver, filename })
}

export const expenseCsvExporter = createExpenseCsvExporter()

export type { Exporter, ExportFile, FileSaver, Serializer } from './types'
export type { CsvColumn } from './csv'
