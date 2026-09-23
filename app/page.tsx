// app/page.tsx
'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { DollarSign, Calendar, TrendingUp, Tag, PlusCircle, Download } from 'lucide-react'
import { useExpenses } from '@/hooks/useExpenses'
import { SummaryCard } from '@/components/SummaryCard'
import { EmptyState } from '@/components/EmptyState'
import { CategoryBadge } from '@/components/CategoryBadge'
import { CurrencyDisplay } from '@/components/CurrencyDisplay'
import { formatCurrency, filterExpensesByDateRange, getMonthlyTotals, formatDate } from '@/lib/utils'
import { downloadCSV } from '@/lib/csvExport'
import type { Category } from '@/lib/types'
import { CATEGORIES } from '@/lib/types'

const CategoryDonutChart = dynamic(
  () => import('@/components/charts/CategoryDonutChart').then((m) => m.CategoryDonutChart),
  { ssr: false, loading: () => <div className="h-64 animate-pulse bg-gray-50 rounded-lg" /> },
)
const MonthlyBarChart = dynamic(
  () => import('@/components/charts/MonthlyBarChart').then((m) => m.MonthlyBarChart),
  { ssr: false, loading: () => <div className="h-56 animate-pulse bg-gray-50 rounded-lg" /> },
)

export default function DashboardPage() {
  const { expenses, isLoaded } = useExpenses()

  if (!isLoaded) {
    return (
      <div className="px-4 py-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <div className="px-4 py-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        </div>
        <EmptyState
          title="No expenses yet"
          description="Add your first expense to see your spending dashboard."
          actionLabel="Add your first expense"
          actionHref="/expenses/new"
        />
      </div>
    )
  }

  const thisMonthExpenses = filterExpensesByDateRange(expenses, 'month')
  const thisWeekExpenses = filterExpensesByDateRange(expenses, 'week')
  const monthlyTotals = getMonthlyTotals(expenses, 6)

  const allTimeTotal = expenses.reduce((s, e) => s + e.amount, 0)
  const monthTotal = thisMonthExpenses.reduce((s, e) => s + e.amount, 0)
  const weekTotal = thisWeekExpenses.reduce((s, e) => s + e.amount, 0)

  const topCategory = CATEGORIES.reduce<{ cat: Category; total: number } | null>((top, cat) => {
    const total = thisMonthExpenses
      .filter((e) => e.category === cat)
      .reduce((s, e) => s + e.amount, 0)
    if (total === 0) return top
    if (!top || total > top.total) return { cat, total }
    return top
  }, null)

  const recent = expenses.slice(0, 5)

  return (
    <div className="px-4 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCSV(expenses)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Data
          </button>
          <Link
            href="/expenses/new"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add Expense
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          title="All Time"
          value={formatCurrency(allTimeTotal)}
          subtitle={`${expenses.length} expenses`}
          icon={DollarSign}
          color="indigo"
        />
        <SummaryCard
          title="This Month"
          value={formatCurrency(monthTotal)}
          subtitle={`${thisMonthExpenses.length} expenses`}
          icon={Calendar}
          color="violet"
        />
        <SummaryCard
          title="This Week"
          value={formatCurrency(weekTotal)}
          subtitle={`${thisWeekExpenses.length} expenses`}
          icon={TrendingUp}
          color="purple"
        />
        <SummaryCard
          title="Top Category"
          value={topCategory?.cat ?? '—'}
          subtitle={topCategory ? formatCurrency(topCategory.total) + ' this month' : 'No data'}
          icon={Tag}
          color="amber"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Spending by Category (This Month)</h2>
          <CategoryDonutChart expenses={thisMonthExpenses} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Monthly Spending (Last 6 Months)</h2>
          <MonthlyBarChart data={monthlyTotals} />
        </div>
      </div>

      {/* Recent expenses */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">Recent Expenses</h2>
          <Link href="/expenses" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
            View all →
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {recent.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm text-gray-900 truncate">{e.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{formatDate(e.date)}</span>
                  <CategoryBadge category={e.category} />
                </div>
              </div>
              <CurrencyDisplay
                amount={e.amount}
                className="text-sm font-semibold text-gray-900 shrink-0 ml-4"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
