// components/cloud/DestinationConfigEditor.tsx
'use client'

import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { isValidEmail } from '@/lib/cloud/integrations'
import type { DestinationConfig, FileFormat } from '@/lib/cloud/types'

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? 'left-[1.125rem]' : 'left-0.5'}`} />
      </button>
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  )
}

function FormatToggle({ value, onChange }: { value: FileFormat; onChange: (f: FileFormat) => void }) {
  return (
    <div role="radiogroup" aria-label="File format" className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {(['csv', 'json'] as const).map((f) => (
        <button
          key={f}
          type="button"
          role="radio"
          aria-checked={value === f}
          onClick={() => onChange(f)}
          className={`rounded-md px-3 py-1 text-xs font-semibold uppercase transition-colors ${value === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {f}
        </button>
      ))}
    </div>
  )
}

function RecipientInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const parts = draft.split(/[,\s;]+/).map((s) => s.trim()).filter(Boolean)
    if (parts.length) onChange([...value, ...parts.filter((p) => !value.includes(p))])
    setDraft('')
  }
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', ' ', 'Tab'].includes(e.key) && draft.trim()) {
      if (e.key !== 'Tab') e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
      {value.map((r) => (
        <span
          key={r}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${isValidEmail(r) ? 'bg-indigo-50 text-indigo-700' : 'bg-red-50 text-red-700 ring-1 ring-red-200'}`}
        >
          {r}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== r))} aria-label={`Remove ${r}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={value.length ? '' : 'accountant@example.com'}
        aria-label="Recipients"
        className="min-w-[8rem] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm focus:outline-none"
      />
    </div>
  )
}

export function DestinationConfigEditor({ config, onChange }: { config: DestinationConfig; onChange: (c: DestinationConfig) => void }) {
  switch (config.kind) {
    case 'download':
      return (
        <Field label="Format">
          <FormatToggle value={config.format} onChange={(format) => onChange({ ...config, format })} />
        </Field>
      )
    case 'email':
      return (
        <div className="space-y-3">
          <Field label="To" hint="Press Enter or comma to add each address.">
            <RecipientInput value={config.recipients} onChange={(recipients) => onChange({ ...config, recipients })} />
          </Field>
          <Field label="Subject">
            <input className={inputClass} value={config.subject} placeholder="Defaults to the report title" onChange={(e) => onChange({ ...config, subject: e.target.value })} />
          </Field>
          <Field label="Message">
            <textarea rows={2} className={inputClass} value={config.message} placeholder="Optional note" onChange={(e) => onChange({ ...config, message: e.target.value })} />
          </Field>
          <Toggle
            checked={config.includeLink}
            onChange={(includeLink) => onChange({ ...config, includeLink })}
            label="Include a view-online link"
            description="Recipients can open the report in a browser, no app needed."
          />
        </div>
      )
    case 'sheet':
      return (
        <div className="space-y-3">
          <Field label="Spreadsheet">
            <input className={inputClass} value={config.spreadsheetName} onChange={(e) => onChange({ ...config, spreadsheetName: e.target.value })} />
          </Field>
          <Toggle
            checked={config.liveSync}
            onChange={(liveSync) => onChange({ ...config, liveSync })}
            label="Keep in sync"
            description="Re-sync automatically whenever you add or edit an expense."
          />
        </div>
      )
    case 'folder':
      return (
        <div className="space-y-3">
          <Field label="Folder">
            <input className={`${inputClass} font-mono`} value={config.folder} onChange={(e) => onChange({ ...config, folder: e.target.value })} />
          </Field>
          <Field label="Format">
            <FormatToggle value={config.format} onChange={(format) => onChange({ ...config, format })} />
          </Field>
        </div>
      )
    case 'channel':
      return (
        <Field label="Channel">
          <input className={inputClass} value={config.channel} onChange={(e) => onChange({ ...config, channel: e.target.value })} />
        </Field>
      )
  }
}
