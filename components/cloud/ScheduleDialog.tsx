// components/cloud/ScheduleDialog.tsx
'use client'

import { useMemo, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { DESTINATION_ORDER, INTEGRATIONS, validateConfig } from '@/lib/cloud/integrations'
import { periodLabel, relativePeriod } from '@/lib/cloud/period'
import { computeNextRun, describeTiming, FREQUENCIES, WEEKDAYS } from '@/lib/cloud/schedule'
import { TEMPLATES } from '@/lib/cloud/templates'
import type { Connection, DestinationConfig, DestinationId, Frequency, TemplateId } from '@/lib/cloud/types'
import type { NewSchedule } from './CloudExportProvider'
import { DestinationConfigEditor, Field, inputClass } from './DestinationConfigEditor'
import { Modal } from './Modal'

export function ScheduleDialog({
  initialTemplate,
  initialDestination,
  initialConfig,
  connections,
  onSave,
  onClose,
}: {
  initialTemplate: TemplateId
  initialDestination: DestinationId
  initialConfig: DestinationConfig
  connections: Partial<Record<DestinationId, Connection>>
  onSave: (s: NewSchedule) => void
  onClose: () => void
}) {
  // Scheduled runs happen unattended, so a browser download isn't a sensible target.
  const available = DESTINATION_ORDER.filter((d) => d !== 'download' && (!INTEGRATIONS[d].requiresConnection || connections[d]))
  const startDest = available.includes(initialDestination) ? initialDestination : available[0]
  const [templateId, setTemplateId] = useState<TemplateId>(initialTemplate)
  const [destinationId, setDestinationId] = useState<DestinationId>(startDest)
  const [config, setConfig] = useState<DestinationConfig>(startDest === initialDestination ? initialConfig : INTEGRATIONS[startDest].defaultConfig())
  const [frequency, setFrequency] = useState<Frequency>(templateId === 'full-backup' ? 'weekly' : 'monthly')
  const [weekday, setWeekday] = useState(1)
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [time, setTime] = useState('08:00')
  const [name, setName] = useState('')

  const timing = { frequency, weekday, dayOfMonth, time }
  const upcoming = useMemo(() => {
    const runs: Date[] = []
    let from = new Date()
    for (let i = 0; i < 3; i++) {
      from = computeNextRun({ frequency, weekday, dayOfMonth, time }, from)
      runs.push(from)
    }
    return runs
  }, [frequency, weekday, dayOfMonth, time])

  const configError = validateConfig(config)
  const defaultName = `${TEMPLATES[templateId].name} → ${INTEGRATIONS[destinationId].name}`

  const save = () => {
    if (configError) return
    onSave({ name: name.trim() || defaultName, templateId, destinationId, config, ...timing })
    onClose()
  }

  return (
    <Modal
      title="Schedule recurring export"
      subtitle="Runs automatically in the background while ExpenseTracker is open. Missed runs catch up on your next visit."
      onClose={onClose}
      width="max-w-xl"
      icon={<span className="rounded-lg bg-violet-50 p-2"><CalendarClock className="h-5 w-5 text-violet-600" aria-hidden /></span>}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{configError ?? describeTiming(timing)}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={save} disabled={!!configError} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-300">Create schedule</button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input className={inputClass} value={name} placeholder={defaultName} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Template" hint={`Each run covers: ${periodLabel(relativePeriod(templateId, frequency))} (relative)`}>
            <select className={inputClass} value={templateId} onChange={(e) => setTemplateId(e.target.value as TemplateId)}>
              {Object.values(TEMPLATES).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Deliver to">
            <select
              className={inputClass}
              value={destinationId}
              onChange={(e) => {
                const d = e.target.value as DestinationId
                setDestinationId(d)
                setConfig(INTEGRATIONS[d].defaultConfig())
              }}
            >
              {available.map((d) => <option key={d} value={d}>{INTEGRATIONS[d].name}</option>)}
            </select>
          </Field>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <DestinationConfigEditor config={config} onChange={setConfig} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Repeat">
            <select className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              {FREQUENCIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </Field>
          {frequency === 'weekly' && (
            <Field label="On">
              <select className={inputClass} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </Field>
          )}
          {frequency === 'monthly' && (
            <Field label="Day">
              <select className={inputClass} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))}>
                {Array.from({ length: 28 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
              </select>
            </Field>
          )}
          <Field label="At">
            <input type="time" className={inputClass} value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
          </Field>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-600">Next runs</p>
          <ol className="flex flex-wrap gap-1.5">
            {upcoming.map((d) => (
              <li key={d.toISOString()} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                {d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Modal>
  )
}
