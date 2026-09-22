// components/ExpenseList.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { CategoryBadge } from '@/components/CategoryBadge'
import { CurrencyDisplay } from '@/components/CurrencyDisplay'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { formatDate } from '@/lib/utils'
import type { Expense } from '@/lib/types'

type SortField = 'date' | 'amount'
type SortDir = 'asc' | 'desc'

export function ExpenseList({
  expenses,
  onDelete,
}: {
  expenses: Expense[]
  onDelete: (id: string) => void
}) {
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sorted = [...expenses].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    if (sortField === 'date') return mul * a.date.localeCompare(b.date)
    return mul * (a.amount - b.amount)
  })

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
    return sortDir === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
  }

  const toDelete = expenses.find((e) => e.id === deleteId)

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <button
                  className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                  onClick={() => toggleSort('date')}
                >
                  Date <SortIcon field="date" />
                </button>
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Description
              </th>
              <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Category
              </th>
              <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <button
                  className="flex items-center gap-1 ml-auto hover:text-gray-900 transition-colors"
                  onClick={() => toggleSort('amount')}
                >
                  Amount <SortIcon field="amount" />
                </button>
              </th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((expense) => (
              <tr key={expense.id} className="hover:bg-gray-50/50 group">
                <td className="py-3.5 px-4 text-sm text-gray-600 whitespace-nowrap">
                  {formatDate(expense.date)}
                </td>
                <td className="py-3.5 px-4 text-sm text-gray-900 max-w-xs truncate">
                  {expense.description}
                </td>
                <td className="py-3.5 px-4">
                  <CategoryBadge category={expense.category} />
                </td>
                <td className="py-3.5 px-4 text-right">
                  <CurrencyDisplay
                    amount={expense.amount}
                    className="text-sm font-semibold text-gray-900"
                  />
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                    <Link
                      href={`/expenses/${expense.id}/edit`}
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      aria-label="Edit expense"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                    <button
                      onClick={() => setDeleteId(expense.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label="Delete expense"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-gray-100">
        {sorted.map((expense) => (
          <div key={expense.id} className="py-4 px-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{expense.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">{formatDate(expense.date)}</span>
                <CategoryBadge category={expense.category} />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <CurrencyDisplay
                amount={expense.amount}
                className="text-sm font-semibold text-gray-900"
              />
              <Link
                href={`/expenses/${expense.id}/edit`}
                className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setDeleteId(expense.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="Delete expense?"
        description={`"${toDelete?.description ?? ''}" will be permanently removed.`}
        onConfirm={() => {
          if (deleteId) onDelete(deleteId)
          setDeleteId(null)
        }}
        onCancel={() => setDeleteId(null)}
      />
    </>
  )
}
