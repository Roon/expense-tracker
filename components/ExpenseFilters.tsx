// components/ExpenseFilters.tsx
'use client'

import { Search, X } from 'lucide-react'
import type { DateRange } from '@/lib/utils'
import type { Category } from '@/lib/types'
import { CATEGORIES } from '@/lib/types'

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'Last 3 months' },
  { value: 'week', label: 'This week' },
]

export function ExpenseFilters({
  search,
  dateRange,
  categories,
  onSearchChange,
  onDateRangeChange,
  onCategoriesChange,
}: {
  search: string
  dateRange: DateRange
  categories: Category[]
  onSearchChange: (v: string) => void
  onDateRangeChange: (v: DateRange) => void
  onCategoriesChange: (v: Category[]) => void
}) {
  function toggleCategory(cat: Category) {
    if (categories.includes(cat)) {
      onCategoriesChange(categories.filter((c) => c !== cat))
    } else {
      onCategoriesChange([...categories, cat])
    }
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search expenses…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Date range + category row */}
      <div className="flex flex-wrap gap-2">
        <select
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value as DateRange)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {DATE_RANGES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => toggleCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              categories.includes(cat)
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  )
}
