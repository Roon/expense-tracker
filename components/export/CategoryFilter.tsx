// components/export/CategoryFilter.tsx
'use client'

import type { Category } from '@/lib/types'
import { CATEGORIES, CATEGORY_COLORS } from '@/lib/types'

export function CategoryFilter({
  selected,
  counts,
  disabled,
  onToggle,
  onSetAll,
}: {
  selected: Category[]
  /** Number of expenses per category within the current date range. */
  counts: Partial<Record<Category, number>>
  disabled?: boolean
  onToggle: (category: Category) => void
  onSetAll: (categories: Category[]) => void
}) {
  const allSelected = selected.length === CATEGORIES.length
  return (
    <div>
      <div className="mb-2 flex justify-end gap-3 text-xs font-medium">
        <button
          type="button"
          disabled={disabled || allSelected}
          onClick={() => onSetAll([...CATEGORIES])}
          className="text-indigo-600 hover:text-indigo-700 disabled:text-gray-300"
        >
          Select all
        </button>
        <button
          type="button"
          disabled={disabled || selected.length === 0}
          onClick={() => onSetAll([])}
          className="text-indigo-600 hover:text-indigo-700 disabled:text-gray-300"
        >
          Clear
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {CATEGORIES.map((cat) => {
          const checked = selected.includes(cat)
          const count = counts[cat] ?? 0
          return (
            <label
              key={cat}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 ${
                checked ? 'border-gray-300 bg-white' : 'border-gray-100 bg-gray-50 text-gray-400'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(cat)}
                className="sr-only"
              />
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: checked ? CATEGORY_COLORS[cat] : '#d1d5db' }}
              />
              <span className="flex-1 truncate">{cat}</span>
              <span className="text-xs tabular-nums text-gray-400">{count}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
