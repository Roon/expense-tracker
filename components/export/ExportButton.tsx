// components/export/ExportButton.tsx
'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'
import type { Expense } from '@/lib/types'
import { ExportDialog } from './ExportDialog'

/** Trigger button; the dialog is mounted only while open so each session starts fresh. */
export function ExportButton({ expenses }: { expenses: Expense[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <FileDown className="h-4 w-4" />
        Export…
      </button>
      {open && <ExportDialog expenses={expenses} onClose={() => setOpen(false)} />}
    </>
  )
}
