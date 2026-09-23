// components/export/DateRangeFields.tsx
'use client'

import { DATE_PRESETS, type DatePresetId } from '@/lib/export'

const inputClass =
  'w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50'

export function DateRangeFields({
  preset,
  startDate,
  endDate,
  invalid,
  disabled,
  onPreset,
  onStartDate,
  onEndDate,
}: {
  preset: DatePresetId
  startDate: string
  endDate: string
  invalid?: boolean
  disabled?: boolean
  onPreset: (preset: Exclude<DatePresetId, 'custom'>) => void
  onStartDate: (value: string) => void
  onEndDate: (value: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {DATE_PRESETS.filter((p) => p.id !== 'custom').map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={disabled}
            aria-pressed={preset === p.id}
            onClick={() => onPreset(p.id as Exclude<DatePresetId, 'custom'>)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              preset === p.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs text-gray-500">Start date</span>
          <input
            type="date"
            value={startDate}
            max={endDate || undefined}
            disabled={disabled}
            aria-invalid={invalid}
            onChange={(e) => onStartDate(e.target.value)}
            className={`${inputClass} ${invalid ? 'border-red-400' : ''}`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-gray-500">End date</span>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            disabled={disabled}
            aria-invalid={invalid}
            onChange={(e) => onEndDate(e.target.value)}
            className={`${inputClass} ${invalid ? 'border-red-400' : ''}`}
          />
        </label>
      </div>
    </div>
  )
}
