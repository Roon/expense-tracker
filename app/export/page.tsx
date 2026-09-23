// app/export/page.tsx
'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, CircleAlert, Link as LinkIcon, Plug, Send, Sparkles } from 'lucide-react'
import { useExpenses } from '@/hooks/useExpenses'
import { useCloudExport } from '@/components/cloud/CloudExportProvider'
import { DestinationGrid, PeriodPicker, TemplateGallery } from '@/components/cloud/Composer'
import { ConnectDialog } from '@/components/cloud/ConnectDialog'
import { DeliveryPreview } from '@/components/cloud/DeliveryPreview'
import { DestinationConfigEditor } from '@/components/cloud/DestinationConfigEditor'
import { ActivityPanel, ConnectionsPanel, SchedulesPanel, SyncStatusPill } from '@/components/cloud/HubPanels'
import { DemoBadge } from '@/components/cloud/IntegrationLogo'
import { ReportView } from '@/components/cloud/ReportView'
import { ScheduleDialog } from '@/components/cloud/ScheduleDialog'
import { ShareDialog } from '@/components/cloud/ShareDialog'
import { INTEGRATIONS, validateConfig } from '@/lib/cloud/integrations'
import { currentMonth } from '@/lib/cloud/period'
import { buildReport, TEMPLATES } from '@/lib/cloud/templates'
import type { DestinationConfig, DestinationId, Period, TemplateId } from '@/lib/cloud/types'

type Tab = 'activity' | 'schedules' | 'connections'
type Dialog = { kind: 'connect'; id: DestinationId } | { kind: 'share' } | { kind: 'schedule' } | null

function defaultPeriod(templateId: TemplateId, now = new Date()): Period {
  const kind = TEMPLATES[templateId].periodKinds[0]
  if (kind === 'month') return currentMonth(now)
  if (kind === 'year') return { kind: 'year', year: now.getFullYear() }
  return { kind: 'all' }
}

export default function ExportHubPage() {
  const { expenses, isLoaded } = useExpenses()
  const cloud = useCloudExport()
  const [templateId, setTemplateId] = useState<TemplateId>('monthly-summary')
  const [period, setPeriod] = useState<Period>(() => defaultPeriod('monthly-summary'))
  const [destinationId, setDestinationId] = useState<DestinationId>('download')
  // Per-destination drafts so switching tiles doesn't wipe what you typed.
  const [configs, setConfigs] = useState<Partial<Record<DestinationId, DestinationConfig>>>({})
  const [previewMode, setPreviewMode] = useState<'report' | 'delivered'>('report')
  const [tab, setTab] = useState<Tab>('activity')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [justSent, setJustSent] = useState(false)

  const config = configs[destinationId] ?? INTEGRATIONS[destinationId].defaultConfig()
  const setConfig = (c: DestinationConfig) => setConfigs((m) => ({ ...m, [destinationId]: c }))
  const integration = INTEGRATIONS[destinationId]
  const connected = !integration.requiresConnection || !!cloud.connections[destinationId]
  const configError = validateConfig(config)
  const report = useMemo(() => buildReport(templateId, expenses, period), [templateId, expenses, period])
  const hasDeliveryPreview = config.kind === 'email' || config.kind === 'sheet' || config.kind === 'channel'

  const chooseTemplate = (t: TemplateId) => {
    setTemplateId(t)
    if (!TEMPLATES[t].periodKinds.includes(period.kind)) setPeriod(defaultPeriod(t))
  }

  const send = () => {
    if (!connected) return setDialog({ kind: 'connect', id: destinationId })
    if (configError) return
    cloud.runExport({ templateId, period, destinationId, config })
    setJustSent(true)
    setTab('activity')
    setTimeout(() => setJustSent(false), 2500)
  }

  if (!isLoaded) {
    return <div className="mx-auto max-w-6xl px-4 py-8"><div className="h-40 animate-pulse rounded-2xl bg-slate-100" /></div>
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Export Hub
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Send your data anywhere</h1>
          <p className="mt-1 text-sm text-slate-500">Pick a report, choose where it goes, and let it run. Share it, schedule it or keep it in sync.</p>
        </div>
        <SyncStatusPill />
      </div>

      {/* 1. Template */}
      <section aria-labelledby="step-template" className="mb-6">
        <h2 id="step-template" className="mb-3 text-sm font-semibold text-slate-700">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] text-white">1</span>
          Choose a template
        </h2>
        <TemplateGallery value={templateId} onChange={chooseTemplate} />
      </section>

      <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        {/* Preview */}
        <section aria-label="Preview" className="order-2 min-w-0 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 lg:order-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-900">{report.title}</p>
              <p className="text-xs text-slate-500">{report.periodLabel} · {report.recordCount} records</p>
            </div>
            {hasDeliveryPreview && (
              <div role="tablist" aria-label="Preview mode" className="inline-flex rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-slate-200">
                {(['report', 'delivered'] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    type="button"
                    aria-selected={previewMode === m}
                    onClick={() => setPreviewMode(m)}
                    className={`rounded-md px-3 py-1 text-xs font-medium ${previewMode === m ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {m === 'report' ? 'Report' : `As it arrives in ${integration.name}`}
                  </button>
                ))}
              </div>
            )}
          </div>
          {hasDeliveryPreview && previewMode === 'delivered' ? (
            <DeliveryPreview report={report} config={config} />
          ) : (
            <ReportView report={report} maxRows={8} />
          )}
        </section>

        {/* 2. Delivery */}
        <section aria-labelledby="step-deliver" className="order-1 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:order-2 lg:self-start">
          <h2 id="step-deliver" className="text-sm font-semibold text-slate-700">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[11px] text-white">2</span>
            Deliver
          </h2>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-600">Period</p>
            <PeriodPicker kinds={TEMPLATES[templateId].periodKinds} value={period} onChange={setPeriod} expenses={expenses} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-600">Destination</p>
            <DestinationGrid value={destinationId} connections={cloud.connections} onChange={setDestinationId} />
          </div>

          {connected ? (
            <DestinationConfigEditor config={config} onChange={setConfig} />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center">
              <p className="text-sm text-slate-700">Connect {integration.name} to send reports there.</p>
              <p className="mt-1 text-xs text-slate-500">{integration.scopes[0]}</p>
            </div>
          )}

          {(integration.requiresConnection || destinationId === 'email') && (
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <DemoBadge /> Simulated delivery. Nothing is sent over the network.
            </p>
          )}

          <div className="space-y-2">
            {connected && configError && (
              <p className="flex items-center gap-1.5 text-xs text-amber-700"><CircleAlert className="h-3.5 w-3.5" aria-hidden />{configError}</p>
            )}
            <button
              type="button"
              onClick={send}
              disabled={connected && !!configError}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:bg-indigo-300"
            >
              {connected ? <Send className="h-4 w-4" aria-hidden /> : <Plug className="h-4 w-4" aria-hidden />}
              {justSent ? 'Started · see activity below' : connected ? integration.action : `Connect ${integration.name}`}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDialog({ kind: 'share' })}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <LinkIcon className="h-4 w-4" aria-hidden /> Share link
              </button>
              <button
                type="button"
                onClick={() => setDialog({ kind: 'schedule' })}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <CalendarClock className="h-4 w-4" aria-hidden /> Schedule
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* 3. Activity / Schedules / Connections */}
      <section className="rounded-2xl border border-slate-200 bg-white">
        <div role="tablist" aria-label="Export management" className="flex gap-1 border-b border-slate-100 px-3 pt-2">
          {([
            ['activity', 'Activity', cloud.history.length],
            ['schedules', 'Schedules', cloud.schedules.length],
            ['connections', 'Connected apps', Object.keys(cloud.connections).length],
          ] as const).map(([id, label, count]) => (
            <button
              key={id}
              role="tab"
              type="button"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {label}
              {count > 0 && <span className="rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">{count}</span>}
            </button>
          ))}
        </div>
        <div role="tabpanel" className="px-4 py-2">
          {tab === 'activity' && <ActivityPanel />}
          {tab === 'schedules' && <SchedulesPanel onCreate={() => setDialog({ kind: 'schedule' })} />}
          {tab === 'connections' && <ConnectionsPanel onConnect={(id) => setDialog({ kind: 'connect', id })} />}
        </div>
      </section>

      {dialog?.kind === 'connect' && (
        <ConnectDialog id={dialog.id} onConnect={(account) => cloud.connect(dialog.id, account)} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'share' && (
        <ShareDialog
          report={report}
          onShared={(url) => cloud.recordShare({ templateId, period, recordCount: report.recordCount, url })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'schedule' && (
        <ScheduleDialog
          initialTemplate={templateId}
          initialDestination={destinationId}
          initialConfig={config}
          connections={cloud.connections}
          onSave={(s) => {
            cloud.addSchedule(s)
            setTab('schedules')
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
