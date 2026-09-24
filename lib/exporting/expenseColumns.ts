// lib/exporting/expenseColumns.ts
import type { Expense } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import type { CsvColumn } from './csv'

/** The expense CSV layout. Add, remove or reorder columns here; the encoder never changes. */
export const EXPENSE_CSV_COLUMNS: readonly CsvColumn<Expense>[] = [
  { header: 'Date', value: (e) => formatDate(e.date) },
  { header: 'Category', value: (e) => e.category },
  { header: 'Amount', value: (e) => e.amount.toFixed(2) },
  { header: 'Description', value: (e) => e.description },
]
