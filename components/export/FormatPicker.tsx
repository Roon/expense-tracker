// components/export/FormatPicker.tsx
'use client'

import { FileBraces, FileSpreadsheet, FileText, type LucideIcon } from 'lucide-react'
import { EXPORT_FORMATS, type ExportFormat } from '@/lib/export'

const ICONS: Record<ExportFormat, LucideIcon> = {
  csv: FileSpreadsheet,
  json: FileBraces,
  pdf: FileText,
}

export function FormatPicker({
  value,
  onChange,
  disabled,
}: {
  value: ExportFormat
  onChange: (format: ExportFormat) => void
  disabled?: boolean
}) {
  return (
    <div role="radiogroup" aria-label="Export format" className="grid grid-cols-3 gap-2">
      {Object.values(EXPORT_FORMATS).map((f) => {
        const Icon = ICONS[f.id]
        const selected = f.id === value
        return (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={selected}
            title={f.description}
            disabled={disabled}
            onClick={() => onChange(f.id)}
            className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs font-semibold transition-colors disabled:opacity-60 ${
              selected
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600'
                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Icon className="h-5 w-5" aria-hidden />
            {f.label}
          </button>
        )
      })}
      <p className="col-span-3 text-xs text-gray-500">{EXPORT_FORMATS[value].description}</p>
    </div>
  )
}
