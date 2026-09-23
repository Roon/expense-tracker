// components/cloud/HubPanels.tsx
'use client'

import { useEffect, useState } from 'react'
import {
  CalendarClock, CircleAlert, CircleCheck, Copy, ExternalLink, LoaderCircle, Pause, Play, Plug, RefreshCw, RotateCcw, Trash, Unplug, Zap,
} from 'lucide-react'
import { DESTINATION_ORDER, INTEGRATIONS } from '@/lib/cloud/integrations'
import { formatBytes, relativeTime } from '@/lib/cloud/format'
import { periodLabel } from '@/lib/cloud/period'
import { describeTiming } from '@/lib/cloud/schedule'
import { TEMPLATES } from '@/lib/cloud/templates'
import type { DestinationId, ExportJob, JobTrigger } from '@/lib/cloud/types'
import { useCloudExport } from './CloudExportProvider'
import { DemoBadge, IntegrationLogo } from './IntegrationLogo'

/** Re-render every 30s so relative timestamps stay fresh. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

const TRIGGER_LABEL: Record<JobTrigger, string> = { manual: 'Manual', schedule: 'Scheduled', sync: 'Live sync', share: 'Share link' }

function EmptyPanel({ icon: Icon, title, body }: { icon: typeof Zap; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-5 w-5 text-slate-400" aria-hidden />
      </span>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="max-w-xs text-xs text-slate-500">{body}</p>
    </div>
  )
}

// ---- Activity -----------------------------------------------------------

export function ActivityPanel() {
  const { history, retryJob, clearHistory } = useCloudExport()
  const now = useNow()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  if (history.length === 0) {
    return <EmptyPanel icon={Zap} title="No exports yet" body="Everything you send, sync, schedule or share will be logged here." />
  }

  const copy = async (job: ExportJob) => {
    if (!job.location) return
    try {
      await navigator.clipboard.writeText(job.location)
      setCopiedId(job.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div>
      <ul className="divide-y divide-slate-100">
        {history.map((job) => (
          <li key={job.id} className="flex items-center gap-3 py-3">
            <IntegrationLogo id={job.trigger === 'share' ? 'download' : job.destinationId} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="font-medium text-slate-900">{TEMPLATES[job.templateId].name}</span>
                <span className="text-slate-400">{periodLabel(job.period)}</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{TRIGGER_LABEL[job.trigger]}</span>
              </p>
              <p className="truncate text-xs text-slate-500" title={job.error ?? job.location ?? ''}>
                {job.status === 'failed'
                  ? <span className="text-red-600">{job.error}</span>
                  : job.status === 'completed'
                    ? <>{job.trigger === 'share' ? 'Link' : job.location}{job.recordCount ? ` · ${job.recordCount} records` : ''}{job.sizeBytes && job.trigger !== 'share' ? ` · ${formatBytes(job.sizeBytes)}` : ''}</>
                    : `${job.stage}…`}
              </p>
            </div>
            <time className="hidden shrink-0 text-xs text-slate-400 sm:block" dateTime={job.createdAt} title={new Date(job.createdAt).toLocaleString()}>
              {relativeTime(job.createdAt, now)}
            </time>
            <StatusIcon status={job.status} />
            <div className="flex shrink-0 gap-0.5">
              {job.trigger === 'share' && job.location && (
                <>
                  <button type="button" onClick={() => copy(job)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Copy link">
                    {copiedId === job.id ? <CircleCheck className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <a href={job.location} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Open shared report">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </>
              )}
              {job.trigger !== 'share' && (job.status === 'completed' || job.status === 'failed') && (
                <button type="button" onClick={() => retryJob(job.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={job.status === 'failed' ? 'Retry' : 'Run again'} title={job.status === 'failed' ? 'Retry' : 'Run again'}>
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={clearHistory} className="text-xs font-medium text-slate-500 hover:text-slate-800">Clear history</button>
      </div>
    </div>
  )
}

function StatusIcon({ status }: { status: ExportJob['status'] }) {
  if (status === 'completed') return <CircleCheck className="h-4 w-4 shrink-0 text-emerald-500" aria-label="Completed" />
  if (status === 'failed') return <CircleAlert className="h-4 w-4 shrink-0 text-red-500" aria-label="Failed" />
  return <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-indigo-500" aria-label="In progress" />
}

// ---- Schedules ----------------------------------------------------------

export function SchedulesPanel({ onCreate }: { onCreate: () => void }) {
  const { schedules, toggleSchedule, removeSchedule, runScheduleNow, connections } = useCloudExport()
  const now = useNow()
  if (schedules.length === 0) {
    return (
      <div>
        <EmptyPanel icon={CalendarClock} title="No schedules" body="Automate the boring part: a monthly summary to your inbox, a weekly backup to Dropbox." />
        <div className="flex justify-center">
          <button type="button" onClick={onCreate} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Create a schedule</button>
        </div>
      </div>
    )
  }
  return (
    <ul className="divide-y divide-slate-100">
      {schedules.map((s) => {
        const needsConnection = INTEGRATIONS[s.destinationId].requiresConnection && !connections[s.destinationId]
        return (
          <li key={s.id} className={`flex items-center gap-3 py-3 ${s.enabled ? '' : 'opacity-60'}`}>
            <IntegrationLogo id={s.destinationId} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
              <p className="truncate text-xs text-slate-500">
                {describeTiming(s)} ·{' '}
                {needsConnection ? (
                  <span className="text-amber-700">Reconnect {INTEGRATIONS[s.destinationId].name}</span>
                ) : s.enabled ? (
                  <>next {relativeTime(s.nextRunAt, now)}</>
                ) : (
                  'paused'
                )}
                {s.lastRunAt && <> · last ran {relativeTime(s.lastRunAt, now)}</>}
              </p>
            </div>
            <div className="flex shrink-0 gap-0.5">
              <button type="button" onClick={() => runScheduleNow(s.id)} className="rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50">Run now</button>
              <button type="button" onClick={() => toggleSchedule(s.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={s.enabled ? `Pause ${s.name}` : `Resume ${s.name}`}>
                {s.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => removeSchedule(s.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${s.name}`}>
                <Trash className="h-4 w-4" />
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ---- Connections --------------------------------------------------------

export function ConnectionsPanel({ onConnect }: { onConnect: (id: DestinationId) => void }) {
  const { connections, disconnect, syncTargets, removeSyncTarget } = useCloudExport()
  const now = useNow()
  const cloud = DESTINATION_ORDER.filter((d) => INTEGRATIONS[d].requiresConnection)
  return (
    <div className="space-y-5">
      <ul className="grid gap-3 sm:grid-cols-2">
        {cloud.map((id) => {
          const i = INTEGRATIONS[id]
          const c = connections[id]
          return (
            <li key={id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <IntegrationLogo id={id} status={c?.status} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">{i.name} <DemoBadge /></p>
                <p className="truncate text-xs text-slate-500">
                  {!c ? i.blurb : c.status === 'syncing' ? <span className="text-sky-600">Syncing…</span> : <>{c.account} · {c.lastSyncAt ? `synced ${relativeTime(c.lastSyncAt, now)}` : 'connected'}</>}
                </p>
              </div>
              {c ? (
                <button type="button" onClick={() => disconnect(id)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label={`Disconnect ${i.name}`}>
                  <Unplug className="h-3.5 w-3.5" /> Disconnect
                </button>
              ) : (
                <button type="button" onClick={() => onConnect(id)} className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" aria-label={`Connect ${i.name}`}>
                  <Plug className="h-3.5 w-3.5" /> Connect
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {syncTargets.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Live-synced sheets
          </h3>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {syncTargets.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-slate-900">{t.spreadsheetName}</p>
                  <p className="truncate text-xs text-slate-500">
                    {TEMPLATES[t.templateId].name} · {periodLabel(t.period)} · {t.lastSyncedAt ? `synced ${relativeTime(t.lastSyncedAt, now)}` : 'waiting'}
                  </p>
                </div>
                <button type="button" onClick={() => removeSyncTarget(t.id)} className="text-xs font-medium text-slate-500 hover:text-slate-800">Stop syncing</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ---- Header status pill -------------------------------------------------

export function SyncStatusPill() {
  const { connections, history, loaded } = useCloudExport()
  const conns = Object.values(connections)
  const running = history.filter((j) => j.status === 'queued' || j.status === 'running').length
  const syncing = running > 0 || conns.some((c) => c?.status === 'syncing')
  if (!loaded) return null
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
        syncing ? 'border-sky-200 bg-sky-50 text-sky-700' : conns.length ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'
      }`}
      aria-live="polite"
    >
      {syncing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <span className={`h-2 w-2 rounded-full ${conns.length ? 'bg-emerald-500' : 'bg-slate-300'}`} />}
      {syncing
        ? `Syncing${running > 1 ? ` · ${running} jobs` : '…'}`
        : conns.length
          ? `${conns.length} service${conns.length === 1 ? '' : 's'} connected · all synced`
          : 'No services connected'}
    </span>
  )
}
