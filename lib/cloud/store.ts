// lib/cloud/store.ts
import type { Connection, DestinationId, ExportJob, Schedule, SyncTarget } from './types'

const KEY = 'expense-tracker-cloud-v1'
export const HISTORY_LIMIT = 50

export interface CloudState {
  connections: Partial<Record<DestinationId, Connection>>
  history: ExportJob[]
  schedules: Schedule[]
  syncTargets: SyncTarget[]
}

export const EMPTY_STATE: CloudState = { connections: {}, history: [], schedules: [], syncTargets: [] }

export function loadCloudState(): CloudState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY_STATE
    const parsed = JSON.parse(raw)
    return {
      connections: parsed.connections ?? {},
      // Jobs interrupted by a reload can't resume; mark them failed rather than spinning forever.
      history: (parsed.history ?? []).map((j: ExportJob) =>
        j.status === 'queued' || j.status === 'running'
          ? { ...j, status: 'failed', stage: 'Interrupted', error: 'The page was closed before this finished.' }
          : j,
      ),
      schedules: parsed.schedules ?? [],
      syncTargets: parsed.syncTargets ?? [],
    }
  } catch {
    return EMPTY_STATE
  }
}

export function saveCloudState(state: CloudState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, history: state.history.slice(0, HISTORY_LIMIT) }))
  } catch {
    // Storage full or unavailable: the hub keeps working for this session.
  }
}
