// components/cloud/CloudExportProvider.tsx
'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { loadFromStorage, STORAGE_KEY } from '@/hooks/useExpenses'
import { downloadBlob } from '@/lib/cloud/download'
import { reportFileName, serializeReport } from '@/lib/cloud/format'
import { describeLocation, INTEGRATIONS } from '@/lib/cloud/integrations'
import { relativePeriod } from '@/lib/cloud/period'
import { computeNextRun, isDue } from '@/lib/cloud/schedule'
import { EMPTY_STATE, HISTORY_LIMIT, loadCloudState, saveCloudState, type CloudState } from '@/lib/cloud/store'
import { buildReport } from '@/lib/cloud/templates'
import type {
  Connection,
  DestinationConfig,
  DestinationId,
  ExportJob,
  JobTrigger,
  Period,
  Schedule,
  SyncTarget,
  TemplateId,
} from '@/lib/cloud/types'
import { JobTray } from './JobTray'

// ---- State --------------------------------------------------------------

type Action =
  | { type: 'hydrate'; state: CloudState }
  | { type: 'connect'; connection: Connection }
  | { type: 'disconnect'; id: DestinationId }
  | { type: 'patchConnection'; id: DestinationId; patch: Partial<Connection> }
  | { type: 'addJob'; job: ExportJob }
  | { type: 'patchJob'; id: string; patch: Partial<ExportJob> }
  | { type: 'clearHistory' }
  | { type: 'addSchedule'; schedule: Schedule }
  | { type: 'patchSchedule'; id: string; patch: Partial<Schedule> }
  | { type: 'removeSchedule'; id: string }
  | { type: 'upsertSyncTarget'; target: SyncTarget }
  | { type: 'patchSyncTarget'; id: string; patch: Partial<SyncTarget> }
  | { type: 'removeSyncTarget'; id: string }

function reducer(state: CloudState, action: Action): CloudState {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'connect':
      return { ...state, connections: { ...state.connections, [action.connection.destinationId]: action.connection } }
    case 'disconnect': {
      const connections = { ...state.connections }
      delete connections[action.id]
      // Disconnecting Sheets also stops live sync; schedules stay but will fail until reconnected.
      const syncTargets = action.id === 'google-sheets' ? [] : state.syncTargets
      return { ...state, connections, syncTargets }
    }
    case 'patchConnection': {
      const current = state.connections[action.id]
      if (!current) return state
      return { ...state, connections: { ...state.connections, [action.id]: { ...current, ...action.patch } } }
    }
    case 'addJob':
      return { ...state, history: [action.job, ...state.history].slice(0, HISTORY_LIMIT) }
    case 'patchJob':
      return { ...state, history: state.history.map((j) => (j.id === action.id ? { ...j, ...action.patch } : j)) }
    case 'clearHistory':
      return { ...state, history: state.history.filter((j) => j.status === 'queued' || j.status === 'running') }
    case 'addSchedule':
      return { ...state, schedules: [...state.schedules, action.schedule] }
    case 'patchSchedule':
      return { ...state, schedules: state.schedules.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)) }
    case 'removeSchedule':
      return { ...state, schedules: state.schedules.filter((s) => s.id !== action.id) }
    case 'upsertSyncTarget': {
      const rest = state.syncTargets.filter((t) => t.id !== action.target.id)
      return { ...state, syncTargets: [...rest, action.target] }
    }
    case 'patchSyncTarget':
      return { ...state, syncTargets: state.syncTargets.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)) }
    case 'removeSyncTarget':
      return { ...state, syncTargets: state.syncTargets.filter((t) => t.id !== action.id) }
  }
}

// ---- Context API --------------------------------------------------------

export interface RunRequest {
  templateId: TemplateId
  period: Period
  destinationId: DestinationId
  config: DestinationConfig
  trigger?: JobTrigger
  scheduleId?: string
}

export type NewSchedule = Omit<Schedule, 'id' | 'createdAt' | 'nextRunAt' | 'lastRunAt' | 'enabled'>

interface CloudExportContextValue extends CloudState {
  loaded: boolean
  /** Jobs started in this browser session, newest first; drives the activity tray. */
  sessionJobIds: string[]
  dismissJob: (id: string) => void
  connect: (id: DestinationId, account: string) => void
  disconnect: (id: DestinationId) => void
  runExport: (req: RunRequest) => string
  retryJob: (id: string) => void
  recordShare: (req: { templateId: TemplateId; period: Period; recordCount: number; url: string }) => void
  clearHistory: () => void
  addSchedule: (s: NewSchedule) => void
  toggleSchedule: (id: string) => void
  removeSchedule: (id: string) => void
  runScheduleNow: (id: string) => void
  removeSyncTarget: (id: string) => void
}

const CloudExportContext = createContext<CloudExportContextValue | null>(null)

export function useCloudExport(): CloudExportContextValue {
  const ctx = useContext(CloudExportContext)
  if (!ctx) throw new Error('useCloudExport must be used inside <CloudExportProvider>')
  return ctx
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2))

const SCHEDULER_INTERVAL_MS = 20_000
const SYNC_POLL_INTERVAL_MS = 3_000

export function CloudExportProvider({
  children,
  stageDelayMs = 650,
}: {
  children: ReactNode
  /** Simulated latency per job stage. Tests pass 0. */
  stageDelayMs?: number
}) {
  const [state, dispatch] = useReducer(reducer, EMPTY_STATE)
  const [loaded, setLoaded] = useState(false)
  const [sessionJobIds, setSessionJobIds] = useState<string[]>([])
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    dispatch({ type: 'hydrate', state: loadCloudState() })
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) saveCloudState(state)
  }, [state, loaded])

  // ---- Job runner -------------------------------------------------------

  const execute = useCallback(
    async (job: ExportJob) => {
      const patch = (p: Partial<ExportJob>) => dispatch({ type: 'patchJob', id: job.id, patch: p })
      const integration = INTEGRATIONS[job.destinationId]
      const cloud = integration.requiresConnection
      try {
        if (cloud && !stateRef.current.connections[job.destinationId]) {
          throw new Error(`${integration.name} is not connected. Connect it and retry.`)
        }
        patch({ status: 'running', stage: 'Collecting expenses', progress: 15 })
        await sleep(stageDelayMs * 0.6)
        const expenses = loadFromStorage()
        const report = buildReport(job.templateId, expenses, job.period)

        const format = 'format' in job.config ? job.config.format : 'csv'
        patch({ stage: `Building ${job.config.kind === 'sheet' ? 'sheet tabs' : format.toUpperCase()}`, progress: 45, recordCount: report.recordCount })
        const blob = serializeReport(report, format, expenses)
        const fileName = job.config.kind === 'sheet' ? job.fileName : reportFileName(job.templateId, job.period, format)
        await sleep(stageDelayMs)

        patch({ stage: integration.deliveringLabel, progress: 80, sizeBytes: blob.size, fileName })
        if (cloud) dispatch({ type: 'patchConnection', id: job.destinationId, patch: { status: 'syncing' } })
        await sleep(stageDelayMs * (cloud ? 1.4 : 0.4))

        if (job.config.kind === 'download') downloadBlob(blob, fileName)
        const now = new Date().toISOString()
        if (cloud) dispatch({ type: 'patchConnection', id: job.destinationId, patch: { status: 'connected', lastSyncAt: now } })
        if (job.config.kind === 'sheet' && job.config.liveSync) {
          const id = `${job.templateId}:${JSON.stringify(job.period)}:${job.config.spreadsheetName}`
          const existing = stateRef.current.syncTargets.find((t) => t.id === id)
          dispatch({
            type: 'upsertSyncTarget',
            target: {
              id,
              templateId: job.templateId,
              period: job.period,
              spreadsheetName: job.config.spreadsheetName,
              createdAt: existing?.createdAt ?? now,
              lastSyncedAt: now,
            },
          })
        }
        patch({
          status: 'completed',
          stage: job.config.kind === 'email' ? 'Delivered' : 'Done',
          progress: 100,
          finishedAt: now,
          location: describeLocation(job.destinationId, job.config, fileName),
        })
      } catch (err) {
        if (cloud) dispatch({ type: 'patchConnection', id: job.destinationId, patch: { status: 'connected' } })
        patch({
          status: 'failed',
          stage: 'Failed',
          finishedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : 'Something went wrong.',
        })
      }
    },
    [stageDelayMs],
  )

  const runExport = useCallback(
    (req: RunRequest) => {
      const job: ExportJob = {
        id: uid(),
        templateId: req.templateId,
        period: req.period,
        destinationId: req.destinationId,
        config: req.config,
        trigger: req.trigger ?? 'manual',
        scheduleId: req.scheduleId,
        status: 'queued',
        stage: 'Queued',
        progress: 0,
        createdAt: new Date().toISOString(),
        finishedAt: null,
        recordCount: 0,
        fileName: req.config.kind === 'sheet' ? req.config.spreadsheetName : '',
        sizeBytes: 0,
        location: null,
      }
      dispatch({ type: 'addJob', job })
      if (job.trigger !== 'sync') setSessionJobIds((ids) => [job.id, ...ids])
      void execute(job)
      return job.id
    },
    [execute],
  )

  const retryJob = useCallback(
    (id: string) => {
      const job = stateRef.current.history.find((j) => j.id === id)
      if (!job) return
      runExport({ templateId: job.templateId, period: job.period, destinationId: job.destinationId, config: job.config, scheduleId: job.scheduleId })
    },
    [runExport],
  )

  const recordShare = useCallback<CloudExportContextValue['recordShare']>(({ templateId, period, recordCount, url }) => {
    const now = new Date().toISOString()
    dispatch({
      type: 'addJob',
      job: {
        id: uid(),
        templateId,
        period,
        destinationId: 'download',
        config: { kind: 'download', format: 'json' },
        trigger: 'share',
        status: 'completed',
        stage: 'Link created',
        progress: 100,
        createdAt: now,
        finishedAt: now,
        recordCount,
        fileName: 'Share link',
        sizeBytes: url.length,
        location: url,
      },
    })
  }, [])

  // ---- Scheduler: runs whatever is due while the app is open -------------

  useEffect(() => {
    if (!loaded) return
    const tick = () => {
      const now = new Date()
      for (const s of stateRef.current.schedules) {
        if (!isDue(s, now)) continue
        // Missed runs (app was closed) collapse into a single catch-up run.
        dispatch({ type: 'patchSchedule', id: s.id, patch: { lastRunAt: now.toISOString(), nextRunAt: computeNextRun(s, now).toISOString() } })
        runExport({
          templateId: s.templateId,
          period: relativePeriod(s.templateId, s.frequency, now),
          destinationId: s.destinationId,
          config: s.config,
          trigger: 'schedule',
          scheduleId: s.id,
        })
      }
    }
    tick()
    const t = setInterval(tick, SCHEDULER_INTERVAL_MS)
    return () => clearInterval(t)
  }, [loaded, runExport])

  // ---- Live sync: re-push linked sheets when expenses change -------------

  useEffect(() => {
    if (!loaded) return
    let last = safeRead()
    const t = setInterval(() => {
      const current = safeRead()
      if (current === last) return
      last = current
      const { syncTargets, connections } = stateRef.current
      if (!connections['google-sheets']) return
      for (const target of syncTargets) {
        runExport({
          templateId: target.templateId,
          period: target.period,
          destinationId: 'google-sheets',
          config: { kind: 'sheet', spreadsheetName: target.spreadsheetName, liveSync: true },
          trigger: 'sync',
        })
      }
    }, SYNC_POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [loaded, runExport])

  // ---- Public API -------------------------------------------------------

  const value = useMemo<CloudExportContextValue>(
    () => ({
      ...state,
      loaded,
      sessionJobIds,
      dismissJob: (id) => setSessionJobIds((ids) => ids.filter((x) => x !== id)),
      connect: (id, account) =>
        dispatch({
          type: 'connect',
          connection: { destinationId: id, status: 'connected', account, connectedAt: new Date().toISOString(), lastSyncAt: null },
        }),
      disconnect: (id) => dispatch({ type: 'disconnect', id }),
      runExport,
      retryJob,
      recordShare,
      clearHistory: () => dispatch({ type: 'clearHistory' }),
      addSchedule: (s) => {
        const now = new Date()
        dispatch({
          type: 'addSchedule',
          schedule: { ...s, id: uid(), enabled: true, createdAt: now.toISOString(), lastRunAt: null, nextRunAt: computeNextRun(s, now).toISOString() },
        })
      },
      toggleSchedule: (id) => {
        const s = state.schedules.find((x) => x.id === id)
        if (!s) return
        // Re-enabling recomputes from now so a paused schedule doesn't fire a stale run immediately.
        dispatch({
          type: 'patchSchedule',
          id,
          patch: s.enabled ? { enabled: false } : { enabled: true, nextRunAt: computeNextRun(s, new Date()).toISOString() },
        })
      },
      removeSchedule: (id) => dispatch({ type: 'removeSchedule', id }),
      runScheduleNow: (id) => {
        const s = state.schedules.find((x) => x.id === id)
        if (!s) return
        dispatch({ type: 'patchSchedule', id, patch: { lastRunAt: new Date().toISOString() } })
        runExport({
          templateId: s.templateId,
          period: relativePeriod(s.templateId, s.frequency),
          destinationId: s.destinationId,
          config: s.config,
          trigger: 'schedule',
          scheduleId: s.id,
        })
      },
      removeSyncTarget: (id) => dispatch({ type: 'removeSyncTarget', id }),
    }),
    [state, loaded, sessionJobIds, runExport, retryJob, recordShare],
  )

  return (
    <CloudExportContext.Provider value={value}>
      {children}
      <JobTray />
    </CloudExportContext.Provider>
  )
}

function safeRead(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

