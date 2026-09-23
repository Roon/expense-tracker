// components/export/ExportPreview.tsx
'use client'

import { SearchX } from 'lucide-react'
import type { Expense } from '@/lib/types'
import { CATEGORIES, CATEGORY_COLORS } from '@/lib/types'
import type { ExportSummary } from '@/lib/export'
import { CategoryBadge } from '@/components/CategoryBadge'
import { formatCurrency, formatDate } from '@/lib/utils'

/** Rendering thousands of rows in a modal is sluggish; the export itself is not capped. */
export const PREVIEW_ROW_LIMIT = 100

export function ExportPreview({
  expenses,
  summary,
}: {
  expenses: Expense[]
  summary: ExportSummary
}) {
  if (expenses.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-center text-gray-400">
        <SearchX className="mb-2 h-8 w-8" aria-hidden />
        <p className="text-sm font-medium text-gray-600">No expenses match these filters</p>
        <p className="mt-0.5 text-xs">Widen the date range or select more categories.</p>
      </div>
    )
  }

  const shown = expenses.slice(0, PREVIEW_ROW_LIMIT)
  const period =
    summary.firstDate === summary.lastDate
      ? formatDate(summary.firstDate!)
      : `${formatDate(summary.firstDate!)} – ${formatDate(summary.lastDate!)}`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <dl className="mb-3 grid grid-cols-3 gap-2">
        <Stat label="Records" value={summary.count.toLocaleString('en-US')} />
        <Stat label="Total" value={formatCurrency(summary.total)} />
        <Stat label="Span" value={period} small />
      </dl>

      {/* Category mix bar */}
      <div className="mb-3 flex h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
        {CATEGORIES.map((cat) => {
          const bucket = summary.byCategory[cat]
          if (!bucket || summary.total === 0) return null
          return (
            <div
              key={cat}
              title={`${cat}: ${formatCurrency(bucket.total)}`}
              style={{ width: `${(bucket.total / summary.total) * 100}%`, backgroundColor: CATEGORY_COLORS[cat] }}
            />
          )
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shown.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-3 py-2 text-gray-500">{formatDate(e.date)}</td>
                <td className="px-3 py-2">
                  <CategoryBadge category={e.category} />
                </td>
                <td className="max-w-[16rem] truncate px-3 py-2 text-gray-900" title={e.description}>
                  {e.description}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-gray-900">
                  {formatCurrency(e.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenses.length > PREVIEW_ROW_LIMIT && (
          <p className="border-t border-gray-100 bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
            Previewing first {PREVIEW_ROW_LIMIT} of {expenses.length.toLocaleString('en-US')} rows — all
            rows will be exported.
          </p>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className={`mt-0.5 truncate font-semibold text-gray-900 ${small ? 'text-xs leading-5' : 'text-base'}`}>
        {value}
      </dd>
    </div>
  )
}
