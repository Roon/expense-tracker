// lib/cloud/types.ts

export type TemplateId = 'monthly-summary' | 'tax-report' | 'category-analysis' | 'full-backup'

export type Period =
  | { kind: 'month'; year: number; month: number } // month is 0-based
  | { kind: 'year'; year: number }
  | { kind: 'all' }

export type CellFormat = 'text' | 'currency' | 'percent' | 'date' | 'number' | 'change'

export interface ReportColumn {
  key: string
  label: string
  format?: CellFormat
}

export type ReportRow = Record<string, string | number | null>

export interface ReportTable {
  id: string
  title: string
  columns: ReportColumn[]
  rows: ReportRow[]
  footer?: ReportRow
  /** Line-item tables contain individual transactions and can be stripped for privacy. */
  itemized?: boolean
}

export interface ReportHighlight {
  label: string
  value: string
  hint?: string
}

/** A rendered, self-contained report: what gets exported, emailed, synced or shared. */
export interface Report {
  templateId: TemplateId
  title: string
  periodLabel: string
  generatedAt: string
  recordCount: number
  highlights: ReportHighlight[]
  tables: ReportTable[]
}

// ---- Destinations & connections -----------------------------------------

export type DestinationId =
  | 'download'
  | 'email'
  | 'google-sheets'
  | 'google-drive'
  | 'dropbox'
  | 'onedrive'
  | 'slack'

export type FileFormat = 'csv' | 'json'

export type DestinationConfig =
  | { kind: 'download'; format: FileFormat }
  | { kind: 'email'; recipients: string[]; subject: string; message: string; includeLink: boolean }
  | { kind: 'sheet'; spreadsheetName: string; liveSync: boolean }
  | { kind: 'folder'; folder: string; format: FileFormat }
  | { kind: 'channel'; channel: string }

export type ConnectionStatus = 'connected' | 'syncing' | 'error'

export interface Connection {
  destinationId: DestinationId
  status: ConnectionStatus
  account: string
  connectedAt: string
  lastSyncAt: string | null
}

// ---- Jobs, history, schedules -------------------------------------------

export type JobTrigger = 'manual' | 'schedule' | 'sync' | 'share'
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface ExportJob {
  id: string
  templateId: TemplateId
  period: Period
  destinationId: DestinationId
  config: DestinationConfig
  trigger: JobTrigger
  status: JobStatus
  stage: string
  progress: number
  createdAt: string
  finishedAt: string | null
  recordCount: number
  fileName: string
  sizeBytes: number
  /** Human-readable pointer to where the result landed (simulated for cloud targets). */
  location: string | null
  scheduleId?: string
  error?: string
}

export type Frequency = 'daily' | 'weekly' | 'monthly'

export interface Schedule {
  id: string
  name: string
  templateId: TemplateId
  destinationId: DestinationId
  config: DestinationConfig
  frequency: Frequency
  /** 0 = Sunday. Used when frequency is weekly. */
  weekday: number
  /** 1-28 so every month has the day. Used when frequency is monthly. */
  dayOfMonth: number
  /** Local time, HH:MM. */
  time: string
  enabled: boolean
  createdAt: string
  nextRunAt: string
  lastRunAt: string | null
}

/** A Google Sheet kept up to date automatically whenever expenses change. */
export interface SyncTarget {
  id: string
  templateId: TemplateId
  period: Period
  spreadsheetName: string
  createdAt: string
  lastSyncedAt: string | null
}
