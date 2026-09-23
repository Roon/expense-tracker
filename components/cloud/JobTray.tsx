// components/cloud/JobTray.tsx
'use client'

import { useEffect } from 'react'
import { CircleAlert, CircleCheck, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { INTEGRATIONS } from '@/lib/cloud/integrations'
import { TEMPLATES } from '@/lib/cloud/templates'
import { periodLabel } from '@/lib/cloud/period'
import type { ExportJob } from '@/lib/cloud/types'
import { useCloudExport } from './CloudExportProvider'
import { IntegrationLogo } from './IntegrationLogo'

const AUTO_DISMISS_MS = 6000

/** Background activity tray, visible on every page while jobs run. */
export function JobTray() {
  const { history, sessionJobIds, dismissJob, retryJob } = useCloudExport()
  const jobs = sessionJobIds
    .map((id) => history.find((j) => j.id === id))
    .filter((j): j is ExportJob => !!j)
    .slice(0, 4)

  if (jobs.length === 0) return null
  return (
    <div
      className="pointer-events-none fixed bottom-20 right-4 z-40 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 md:bottom-4"
      aria-live="polite"
      aria-label="Export activity"
    >
      {jobs.map((job) => (
        <TrayItem key={job.id} job={job} onDismiss={() => dismissJob(job.id)} onRetry={() => { dismissJob(job.id); retryJob(job.id) }} />
      ))}
    </div>
  )
}

function TrayItem({ job, onDismiss, onRetry }: { job: ExportJob; onDismiss: () => void; onRetry: () => void }) {
  const done = job.status === 'completed'
  const failed = job.status === 'failed'

  useEffect(() => {
    if (!done) return
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  return (
    <div className="pointer-events-auto overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-900/10">
      <div className="flex items-start gap-3 p-3">
        <IntegrationLogo id={job.destinationId} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">
            {TEMPLATES[job.templateId].name} · {periodLabel(job.period)}
          </p>
          <p className={`mt-0.5 flex items-center gap-1 text-xs ${failed ? 'text-red-600' : done ? 'text-emerald-700' : 'text-slate-500'}`}>
            {failed ? (
              <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : done ? (
              <CircleCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
            )}
            <span className="truncate">
              {failed ? job.error : done ? `${job.stage} · ${job.location ?? INTEGRATIONS[job.destinationId].name}` : `${job.stage}…`}
            </span>
          </p>
        </div>
        {failed && (
          <button type="button" onClick={onRetry} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Retry export">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="button" onClick={onDismiss} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Dismiss">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="h-1 bg-slate-100">
        <div
          className={`h-full transition-all duration-500 ${failed ? 'bg-red-500' : done ? 'bg-emerald-500' : 'bg-indigo-500'}`}
          style={{ width: `${failed ? 100 : job.progress}%` }}
        />
      </div>
    </div>
  )
}
