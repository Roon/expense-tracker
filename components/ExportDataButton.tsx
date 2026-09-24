// components/ExportDataButton.tsx
'use client'

import { Download } from 'lucide-react'
import type { Expense } from '@/lib/types'
import { expenseCsvExporter, type Exporter } from '@/lib/exporting'

/** Presentational trigger. The exporter is injectable, defaulting to CSV download. */
export function ExportDataButton({
  expenses,
  exporter = expenseCsvExporter,
}: {
  expenses: readonly Expense[]
  exporter?: Exporter<Expense>
}) {
  return (
    <button
      type="button"
      onClick={() => exporter.export(expenses)}
      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <Download className="w-4 h-4" />
      Export Data
    </button>
  )
}
