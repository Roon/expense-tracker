// app/expenses/page.tsx
'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PlusCircle, Download } from 'lucide-react'
import { useExpenses } from '@/hooks/useExpenses'
import { ExpenseFilters } from '@/components/ExpenseFilters'
import { ExpenseList } from '@/components/ExpenseList'
import { EmptyState } from '@/components/EmptyState'
import { filterExpensesByDateRange, formatCurrency, type DateRange } from '@/lib/utils'
import { expenseCsvExporter } from '@/lib/exporting'
import type { Category } from '@/lib/types'

export default function ExpensesPage() {
  const { expenses, isLoaded, deleteExpense } = useExpenses()
  const [search, setSearch] = useState('')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [categories, setCategories] = useState<Category[]>([])
  const [exportDone, setExportDone] = useState(false)

  const filtered = useMemo(() => {
    let result = filterExpensesByDateRange(expenses, dateRange)
    if (categories.length > 0) {
      result = result.filter((e) => categories.includes(e.category))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((e) => e.description.toLowerCase().includes(q))
    }
    return result
  }, [expenses, dateRange, categories, search])

  const total = filtered.reduce((sum, e) => sum + e.amount, 0)

  function handleExport() {
    expenseCsvExporter.export(filtered)
    setExportDone(true)
    setTimeout(() => setExportDone(false), 2000)
  }

  if (!isLoaded) {
    return (
      <div className="px-4 py-8 max-w-5xl mx-auto space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          {expenses.length > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {filtered.length} expense{filtered.length !== 1 ? 's' : ''} · {formatCurrency(total)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {filtered.length > 0 && (
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              {exportDone ? 'Exported!' : 'Export CSV'}
            </button>
          )}
          <Link
            href="/expenses/new"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add
          </Link>
        </div>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          title="No expenses yet"
          description="Start tracking your spending by adding your first expense."
          actionLabel="Add your first expense"
          actionHref="/expenses/new"
        />
      ) : (
        <>
          <div className="mb-4">
            <ExpenseFilters
              search={search}
              dateRange={dateRange}
              categories={categories}
              onSearchChange={setSearch}
              onDateRangeChange={setDateRange}
              onCategoriesChange={setCategories}
            />
          </div>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              No expenses match your filters.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200">
              <ExpenseList expenses={filtered} onDelete={deleteExpense} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
